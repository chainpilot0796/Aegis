/**
 * Elsa AI Agent - Intent parsing and action routing
 * Bridges natural language (WhatsApp, REST) to the dapp + HeyElsa x402.
 * OpenClaw-style agent: maps intents to local actions (perp, shield, vault) or HeyElsa (portfolio, yield, swap).
 */

const axios = require("axios");
const tradeService = require("./tradeService");
const yieldShieldEngine = require("../engine/yieldShieldEngine");
const vaultEngine = require("../engine/vaultEngine");
const heyelsaService = require("./heyelsaService");
const { MARKETS } = require("../config/markets");
const WalletLink = require("../models/WalletLink");
const CustodialWallet = require("../models/CustodialWallet");
const User = require("../models/User");
const bitgoCustodyService = require("./bitgoCustodyService");
const openaiIntentParser = require("./openaiIntentParser");
const onChainSettlement = require("./onChainSettlementService");
const usdcBalanceService = require("./usdcBalanceService");

// Base Sepolia explorer
const EXPLORER_BASE = "https://sepolia.basescan.org";

/** Quick check if message might be a trade intent (long/short/open/buy) */
function looksLikeTradeIntent(text) {
  const lower = (text || "").toLowerCase();
  return /long|short|open\s+long|open\s+short|go\s+long|go\s+short|buy\s+\$?|sell\s+short|\$\d+.*(eth|btc|sol|gold)/i.test(
    lower,
  );
}

function explorerWalletUrl(address) {
  if (!address) return "";
  const addr = String(address).toLowerCase();
  return `${EXPLORER_BASE}/address/${addr}`;
}

function explorerTxUrl(txHash) {
  if (!txHash) return "";
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

/** POST to trade API — NLP → format → POST /api/trade/open */
async function callTradeOpen(payload) {
  const base =
    process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  try {
    const res = await axios.post(`${base}/api/trade/open`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error || err.message || "Trade failed";
    throw new Error(msg);
  }
}

// Pending confirmations (phone -> { intent, confirmIntent })
const pendingConfirmations = new Map();

function setPendingConfirmation(phone, data) {
  pendingConfirmations.set(phone, { ...data, at: Date.now() });
  setTimeout(() => pendingConfirmations.delete(phone), 5 * 60 * 1000); // 5 min expiry
}

function getAndClearPendingConfirmation(phone) {
  const p = pendingConfirmations.get(phone);
  pendingConfirmations.delete(phone);
  return p;
}

function hasPendingConfirmation(phone) {
  return pendingConfirmations.has(phone);
}

// Map common terms to our market IDs
const ASSET_ALIASES = {
  eth: "ethereum",
  ethereum: "ethereum",
  btc: "bitcoin",
  bitcoin: "bitcoin",
  sol: "solana",
  solana: "solana",
  gold: "gold",
  silver: "silver",
  oil: "wti_oil",
  wti: "wti_oil",
  gas: "natural_gas",
  "natural gas": "natural_gas",
  usd: "usd_inr",
  inr: "usd_inr",
  rupee: "usd_inr",
  eur: "eur_usd",
  euro: "eur_usd",
  gbp: "gbp_usd",
  nyc: "re_nyc",
  "new york": "re_nyc",
  miami: "re_miami",
  brooklyn: "re_brooklyn",
  la: "re_la",
  sf: "re_sf",
  housing: "re_nyc",
  "real estate": "re_nyc",
};

function parseAsset(text) {
  const lower = (text || "").toLowerCase().trim();
  for (const [alias, id] of Object.entries(ASSET_ALIASES)) {
    if (lower.includes(alias)) return id;
  }
  // Try direct market id
  const m = MARKETS.find(
    (x) => x.id === lower || x.name.toLowerCase().includes(lower),
  );
  return m ? m.id : null;
}

function parseNumber(text) {
  const m = (text || "").match(/[\d,.]+/);
  return m ? parseFloat(m[0].replace(/,/g, "")) : null;
}

function detectIntent(message) {
  const lower = (message || "").toLowerCase().trim();

  // Deposit address / create custodial wallet (preferred flow)
  if (
    /^(deposit|get\s+address|my\s+address|create\s+wallet|wallet\s+address|where\s+to\s+send|send\s+funds)$/i.test(
      lower.trim(),
    ) ||
    /deposit\s+address|receive\s+address|fund\s+wallet/i.test(lower)
  ) {
    return { intent: "get_deposit_address" };
  }

  // Check balance
  if (
    /^(balance|check\s+balance|my\s+balance|how\s+much|funds|usdc\s+balance|check\s+funds)$/i.test(
      lower.trim(),
    ) ||
    /show\s+(my\s+)?balance|what('s| is)\s+my\s+balance|how\s+much\s+(do\s+i\s+have|usdc|money)/i.test(
      lower,
    )
  ) {
    return { intent: "check_balance" };
  }

  // Link wallet (fallback: use your own EOA)
  if (
    /link\s+0x[a-fA-F0-9]{40}/.test(lower) ||
    /connect\s+0x[a-fA-F0-9]{40}/.test(lower)
  ) {
    const addr = lower.match(/0x[a-fA-F0-9]{40}/)?.[0];
    return { intent: "link_wallet", address: addr };
  }

  // Open long
  if (
    /long\s+\$?\d+|go\s+long|buy\s+\$?\d+|open\s+long|long\s+(eth|btc|sol|gold|bitcoin|ethereum|solana)/i.test(
      lower,
    )
  ) {
    const asset = parseAsset(lower) || "ethereum";
    const margin = parseNumber(lower) || 100;
    const levMatch = lower.match(/(\d+)x\s*leverage|leverage\s*(\d+)|(\d+)x/);
    const leverage = levMatch
      ? parseInt(levMatch[1] || levMatch[2] || levMatch[3], 10)
      : 2;
    return {
      intent: "open_long",
      asset,
      margin: Math.min(margin, 10000),
      leverage,
    };
  }

  // Open short
  if (
    /short\s+\$?\d+|go\s+short|sell\s+short|open\s+short|short\s+(eth|btc|sol|gold)/i.test(
      lower,
    )
  ) {
    const asset = parseAsset(lower) || "ethereum";
    const margin = parseNumber(lower) || 100;
    const levMatch = lower.match(/(\d+)x\s*leverage|leverage\s*(\d+)|(\d+)x/);
    const leverage = levMatch
      ? parseInt(levMatch[1] || levMatch[2] || levMatch[3], 10)
      : 2;
    return {
      intent: "open_short",
      asset,
      margin: Math.min(margin, 10000),
      leverage,
    };
  }

  // Close position
  if (
    /close\s+(position|all|everything)|close\s+position|exit\s+all/i.test(lower)
  ) {
    return { intent: "close_position" };
  }

  // Hedge / Yield Shield
  if (
    /hedge\s+\$?\d+|protect\s+\$?\d+|shield\s+\$?\d+|hedge\s+against|protect.*inflation|shield.*inflation/i.test(
      lower,
    ) ||
    /inflation\s+hedge|hedge\s+inflation|protect.*portfolio/i.test(lower)
  ) {
    const amount = parseNumber(lower) || 500;
    const asset = parseAsset(lower) || "gold";
    const durMatch = lower.match(/(\d+)\s*month|(\d+)\s*mo/);
    const durationMonths = durMatch
      ? parseInt(durMatch[1] || durMatch[2], 10)
      : 3;
    return {
      intent: "create_shield",
      depositAmount: Math.min(amount, 100000),
      asset,
      durationMonths: Math.min(durationMonths, 12),
    };
  }

  // Portfolio / positions
  if (
    /(show|get|my)\s+(portfolio|positions|balances)|positions\s*$|portfolio\s*$/i.test(
      lower,
    ) ||
    /what('s| is)\s+my\s+(portfolio|positions)/i.test(lower)
  ) {
    return { intent: "show_portfolio" };
  }

  // Analyze wallet (HeyElsa)
  if (
    /analyze\s+(my\s+)?wallet|wallet\s+analysis|risk\s+analysis|analyze\s+me/i.test(
      lower,
    )
  ) {
    return { intent: "analyze_wallet" };
  }

  // Yield suggestions (HeyElsa)
  if (
    /yield|where\s+to\s+earn|best\s+yield|yield\s+suggestions|earn\s+(more\s+)?yield/i.test(
      lower,
    )
  ) {
    return { intent: "yield_suggestions" };
  }

  // Leaderboard
  if (/leaderboard|top\s+traders|rankings|who('s| is)\s+winning/i.test(lower)) {
    return { intent: "leaderboard" };
  }

  // Swap (HeyElsa) - optional
  if (/swap\s+\d+|convert\s+\d+|swap\s+\$\d+/i.test(lower)) {
    const amount = parseNumber(lower);
    const fromToken = /usdc|usd\s+to\s+eth/i.test(lower) ? "USDC" : null;
    const toToken = /to\s+eth|to\s+ethereum|usdc\s+to\s+eth/i.test(lower)
      ? "WETH"
      : null;
    return { intent: "swap_quote", amount, fromToken, toToken };
  }

  // Confirm pending (e.g. "YES" after shield projection)
  if (
    /^(yes|y|confirm|activate|ok|sure|do\s+it|proceed|go\s+ahead|approve)$/i.test(
      lower.trim(),
    )
  ) {
    return { intent: "confirm_pending" };
  }

  // Help
  if (/help|hi|hello|what\s+can\s+you\s+do|commands/i.test(lower)) {
    return { intent: "help" };
  }

  return { intent: "unknown", raw: message };
}

/**
 * Resolve intent with OpenAI NLP first for trade-like messages, fallback to regex.
 * @param {string} message
 * @returns {Promise<{ intent: string, asset?: string, margin?: number, leverage?: number, ... }>}
 */
async function getIntent(message) {
  const text = (message || "").trim();
  if (!text) return { intent: "unknown", raw: message };

  // Try OpenAI first for trade intents when configured
  if (openaiIntentParser.isConfigured() && looksLikeTradeIntent(text)) {
    const openaiIntent = await openaiIntentParser.parseTradeIntent(text);
    if (
      openaiIntent &&
      (openaiIntent.intent === "open_long" ||
        openaiIntent.intent === "open_short")
    ) {
      return openaiIntent;
    }
  }
  return detectIntent(message);
}

async function resolveWallet(phoneOrAddress) {
  if (phoneOrAddress && phoneOrAddress.startsWith("0x")) {
    return phoneOrAddress;
  }
  const custodial = await CustodialWallet.findOne({
    phone: phoneOrAddress,
  }).lean();
  if (custodial?.receiveAddress) return custodial.receiveAddress;
  const link = await WalletLink.findOne({ phone: phoneOrAddress }).lean();
  return link?.address || null;
}

async function executeIntent(intent, address, options = {}) {
  const addr = address ? address.toLowerCase() : null;

  if (
    !addr &&
    intent.intent !== "get_deposit_address" &&
    intent.intent !== "help" &&
    intent.intent !== "check_balance"
  ) {
    return {
      success: false,
      message:
        "Get your custodial wallet first. Send: deposit\nI'll create a BitGo custodial wallet and give you a deposit address. Send USDC there, then chat to trade.",
    };
  }

  if (addr) {
    // Ensure User exists for this address (e.g. custodial receive address)
    await User.findOneAndUpdate(
      { address: addr },
      { $set: { lastActiveAt: new Date() } },
      { upsert: true },
    );
  }

  try {
    switch (intent.intent) {
      case "link_wallet":
        return {
          success: false,
          message: "Link wallet via phone context — use /link from WhatsApp",
        };

      case "check_balance": {
        if (!addr) {
          return {
            success: false,
            message:
              'Send "deposit" first to create your wallet, then check your balance.',
          };
        }
        const user = await User.findOne({ address: addr }).lean();
        const onChainBal = await usdcBalanceService.getUsdcBalance(addr);
        const traderBal = user?.traderBalance || 0;
        const walletLink = explorerWalletUrl(addr);

        const lines = [
          `💰 Your Balance`,
          ``,
          `Trading Balance: $${traderBal.toFixed(2)} USDC`,
          // `On-Chain USDC: $${onChainBal.toFixed(2)}`,
          ``,
          `Wallet: ${addr.slice(0, 6)}...${addr.slice(-4)}`,
        ];
        if (walletLink) {
          lines.push(`Explorer: ${walletLink}`);
        }
        lines.push(
          "",
          "Send USDC to your deposit address to top up. Deposits are auto-detected.",
        );
        return {
          success: true,
          message: lines.join("\n"),
          data: { traderBalance: traderBal, onChainBalance: onChainBal },
        };
      }

      case "open_long": {
        const payload = {
          address: addr,
          marketId: intent.asset,
          direction: "LONG",
          margin: intent.margin,
          leverage: intent.leverage,
        };
        const { position: posLong } = await callTradeOpen(payload);
        const mktLong = MARKETS.find((x) => x.id === intent.asset);

        // On-chain settlement — get tx hash
        let settlementResult = null;
        try {
          settlementResult = await onChainSettlement.settleTradeOpen({
            userAddress: addr,
            margin: intent.margin,
            marketId: intent.asset,
            direction: "LONG",
          });
        } catch (err) {
          console.warn(
            "[ElsaAgent] Settlement failed (non-blocking):",
            err.message,
          );
        }

        const lines = [
          `✅ Long Opened: ${mktLong?.name || intent.asset}`,
          ``,
          `Margin: $${intent.margin} | Leverage: ${intent.leverage}x`,
          `Entry Price: $${posLong.entryPrice}`,
          `Position Size: $${(intent.margin * intent.leverage).toFixed(2)}`,
        ];

        if (settlementResult?.txHash) {
          lines.push("");
          lines.push(`🔗 On-Chain Tx: ${settlementResult.explorerUrl}`);
          lines.push(`Tx Hash: ${settlementResult.txHash}`);
        }

        const walletLink = explorerWalletUrl(addr);
        if (walletLink) {
          lines.push(`\nWallet: ${walletLink}`);
        }

        return {
          success: true,
          message: lines.join("\n"),
          data: {
            ...posLong,
            txHash: settlementResult?.txHash || null,
            explorerUrl: settlementResult?.explorerUrl || null,
          },
        };
      }

      case "open_short": {
        const payload = {
          address: addr,
          marketId: intent.asset,
          direction: "SHORT",
          margin: intent.margin,
          leverage: intent.leverage,
        };
        const { position: posShort } = await callTradeOpen(payload);
        const mktShort = MARKETS.find((x) => x.id === intent.asset);

        // On-chain settlement — get tx hash
        let settlementResult = null;
        try {
          settlementResult = await onChainSettlement.settleTradeOpen({
            userAddress: addr,
            margin: intent.margin,
            marketId: intent.asset,
            direction: "SHORT",
          });
        } catch (err) {
          console.warn(
            "[ElsaAgent] Settlement failed (non-blocking):",
            err.message,
          );
        }

        const lines = [
          `✅ Short Opened: ${mktShort?.name || intent.asset}`,
          ``,
          `Margin: $${intent.margin} | Leverage: ${intent.leverage}x`,
          `Entry Price: $${posShort.entryPrice}`,
          `Position Size: $${(intent.margin * intent.leverage).toFixed(2)}`,
        ];

        if (settlementResult?.txHash) {
          lines.push("");
          lines.push(`🔗 On-Chain Tx: ${settlementResult.explorerUrl}`);
          lines.push(`Tx Hash: ${settlementResult.txHash}`);
        }

        const walletLink = explorerWalletUrl(addr);
        if (walletLink) {
          lines.push(`\nWallet: ${walletLink}`);
        }

        return {
          success: true,
          message: lines.join("\n"),
          data: {
            ...posShort,
            txHash: settlementResult?.txHash || null,
            explorerUrl: settlementResult?.explorerUrl || null,
          },
        };
      }

      case "close_position": {
        const positions = await tradeService.getOpenPositions(addr);
        if (positions.length === 0) {
          return { success: true, message: "No open positions to close." };
        }
        const closed = [];
        let lastSettlement = null;
        for (const p of positions) {
          const c = await tradeService.closePosition(p._id);
          const mkt = MARKETS.find((x) => x.id === p.marketId);

          // On-chain settlement for close
          try {
            lastSettlement = await onChainSettlement.settleTradeClose({
              userAddress: addr,
              realizedPnl: c.realizedPnl || 0,
              margin: p.margin,
            });
          } catch (err) {
            console.warn("[ElsaAgent] Close settlement failed:", err.message);
          }

          closed.push(
            `${mkt?.name || p.marketId}: PnL $${(c.realizedPnl || 0).toFixed(2)}`,
          );
        }

        const lines = [`Closed ${closed.length} position(s):`, ...closed];
        if (lastSettlement?.txHash) {
          lines.push("");
          lines.push(`🔗 Settlement Tx: ${lastSettlement.explorerUrl}`);
          lines.push(`Tx Hash: ${lastSettlement.txHash}`);
        }

        return {
          success: true,
          message: lines.join("\n"),
          data: { closed, txHash: lastSettlement?.txHash || null },
        };
      }

      case "create_shield": {
        const projection = yieldShieldEngine.getProjection({
          depositAmount: intent.depositAmount,
          asset: intent.asset,
          durationMonths: intent.durationMonths,
        });
        if (options.confirm !== true) {
          return {
            success: true,
            needsConfirmation: true,
            message: `Yield Shield Ready:\n\nAsset: ${projection.assetName}\nDeposit: $${intent.depositAmount}\nDuration: ${intent.durationMonths} months\nExposure: $${projection.exposureBudget}\nYield APY: ${projection.yieldApy}%\n\nReply YES to activate.`,
            data: projection,
            confirmIntent: intent,
          };
        }
        const shield = await yieldShieldEngine.createShield({
          address: addr,
          depositAmount: intent.depositAmount,
          asset: intent.asset,
          durationMonths: intent.durationMonths,
        });
        return {
          success: true,
          message: `Shield activated! 🛡️\nAsset: ${shield.assetName}\nDeposit: $${shield.depositAmount}\nENS: ${shield.ensSubname || "—"}`,
          data: shield,
        };
      }

      case "show_portfolio": {
        const [positions, shields, user] = await Promise.all([
          tradeService.getOpenPositions(addr),
          yieldShieldEngine.getActiveShields(addr),
          User.findOne({ address: addr }).lean(),
        ]);

        let lines = [
          `💰 Portfolio (${addr.slice(0, 6)}...${addr.slice(-4)})`,
          "",
        ];
        if (user) {
          lines.push(`Balance: $${(user.traderBalance || 0).toFixed(2)}`);
          lines.push(`Total PnL: $${(user.totalPnl || 0).toFixed(2)}`);
          lines.push("");
        }
        if (positions.length > 0) {
          lines.push("📈 Open Positions:");
          positions.forEach((p) => {
            const mkt = MARKETS.find((x) => x.id === p.marketId);
            lines.push(
              `  ${p.direction} ${mkt?.name || p.marketId}: $${p.margin} @ ${p.leverage}x | PnL $${(p.unrealizedPnl || 0).toFixed(2)}`,
            );
          });
          lines.push("");
        }
        if (shields.length > 0) {
          lines.push("🛡️ Active Shields:");
          shields.forEach((s) => {
            lines.push(
              `  ${s.assetName}: $${s.depositAmount} | ${s.durationMonths}mo`,
            );
          });
        }
        if (
          positions.length === 0 &&
          shields.length === 0 &&
          (!user || user.traderBalance === 0)
        ) {
          lines.push(
            'No positions or shields. Try: "Long $100 ETH 3x" or "Hedge $500 against inflation"',
          );
        }

        // Optionally enrich with HeyElsa multi-chain portfolio
        if (heyelsaService.isInitialized()) {
          const elsa = await heyelsaService.getPortfolio(addr);
          if (elsa.ok && elsa.data?.total_value_usd) {
            lines.push("");
            lines.push(
              `📊 Total (15+ chains): $${parseFloat(elsa.data.total_value_usd || 0).toFixed(2)}`,
            );
          }
        }

        // Explorer link
        const walletLink = explorerWalletUrl(addr);
        if (walletLink) {
          lines.push("");
          lines.push(`Explorer: ${walletLink}`);
        }

        return {
          success: true,
          message: lines.join("\n"),
          data: { positions, shields, user },
        };
      }

      case "analyze_wallet": {
        // Try HeyElsa x402 first; fall back to local data on any error (e.g. 402, funds, etc.)
        if (heyelsaService.isInitialized()) {
          const res = await heyelsaService.analyzeWallet(addr);
          if (res.ok) {
            const summary =
              typeof res.data === "object"
                ? JSON.stringify(res.data, null, 2).slice(0, 500)
                : String(res.data);
            return {
              success: true,
              message: `Wallet Analysis:\n${summary}\n\n(Full data via API)`,
              data: res.data,
            };
          }
          console.warn(
            "[Elsa] HeyElsa analyzeWallet failed, falling back to local data:",
            res.error,
          );
        }

        // Local analysis using local data
        const [positions, shields, user] = await Promise.all([
          tradeService.getOpenPositions(addr),
          yieldShieldEngine.getActiveShields(addr),
          User.findOne({ address: addr }).lean(),
        ]);
        const onChainBal = await usdcBalanceService.getUsdcBalance(addr);

        const lines = [
          `🔍 Wallet Analysis`,
          `${addr.slice(0, 6)}...${addr.slice(-4)}`,
          "",
        ];
        if (user) {
          lines.push(
            `Trading Balance: $${(user.traderBalance || 0).toFixed(2)} USDC`,
          );
          // lines.push(`On-Chain Balance: $${onChainBal.toFixed(2)} USDC`);
          lines.push(`Total PnL: $${(user.totalPnl || 0).toFixed(2)}`);
          lines.push(
            `Trades: ${user.tradeCount || 0} | Shields: ${user.shieldCount || 0}`,
          );
          lines.push("");
        } else {
          // lines.push(`On-Chain Balance: $${onChainBal.toFixed(2)} USDC`);
          lines.push("");
        }
        if (positions.length > 0) {
          lines.push(`📈 Open Positions (${positions.length}):`);
          positions.forEach((p) => {
            const mkt = MARKETS.find((x) => x.id === p.marketId);
            lines.push(
              `  ${p.direction} ${mkt?.name || p.marketId}: $${p.margin} @ ${p.leverage}x | PnL: $${(p.unrealizedPnl || 0).toFixed(2)}`,
            );
          });
          lines.push("");
        }
        if (shields.length > 0) {
          lines.push(`🛡️ Active Shields (${shields.length}):`);
          shields.forEach((s) => {
            lines.push(
              `  ${s.assetName}: $${s.depositAmount} | ${s.durationMonths}mo | APY: ${s.yieldApy}%`,
            );
          });
          lines.push("");
        }
        if (!user && positions.length === 0 && shields.length === 0) {
          lines.push(
            'No activity yet. Start with: "Hedge $100" or "Long $100 ETH 3x"',
          );
        }
        lines.push(`Explorer: ${explorerWalletUrl(addr)}`);

        return {
          success: true,
          message: lines.join("\n"),
          data: { positions, shields, user, onChainBalance: onChainBal },
        };
      }

      case "yield_suggestions": {
        if (!heyelsaService.isInitialized()) {
          const rates = yieldShieldEngine.getBestYield();
          const top = rates[0];
          return {
            success: true,
            message: `Aegis Yield:\n${top.protocol} - ${top.vault}: ${top.currentApy}% APY\n\nCreate a Yield Shield to earn + hedge.`,
            data: rates,
          };
        }
        const res = await heyelsaService.getYieldSuggestions(addr);
        if (!res.ok) {
          const rates = yieldShieldEngine.getBestYield();
          const top = rates[0];
          return {
            success: true,
            message: `Aegis Yield:\n${top.protocol} - ${top.vault}: ${top.currentApy}% APY`,
            data: rates,
          };
        }
        const ys =
          typeof res.data === "object"
            ? JSON.stringify(res.data).slice(0, 400)
            : String(res.data);
        return {
          success: true,
          message: `Yield Suggestions (HeyElsa):\n${ys}`,
          data: res.data,
        };
      }

      case "leaderboard": {
        const traders = await User.find({
          $or: [{ tradeCount: { $gt: 0 } }, { shieldCount: { $gt: 0 } }],
        })
          .sort({ totalPnl: -1 })
          .limit(5)
          .lean();

        const lines = ["🏆 Leaderboard", ""];
        traders.forEach((t, i) => {
          lines.push(
            `${i + 1}. ${t.address.slice(0, 6)}...${t.address.slice(-4)}: $${(t.totalPnl || 0).toFixed(2)} PnL`,
          );
        });
        return { success: true, message: lines.join("\n"), data: traders };
      }

      case "swap_quote":
        if (!heyelsaService.isInitialized()) {
          return {
            success: true,
            message:
              "Swap via HeyElsa x402 when configured. Use web app for now.",
          };
        }
        const sq = await heyelsaService.getSwapQuote({
          from_chain: "base",
          from_token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          from_amount: String(intent.amount || 100),
          to_chain: "base",
          to_token: "0x4200000000000000000000000000000000000006",
          wallet_address: addr,
          slippage: 2.0,
        });
        if (!sq.ok) return { success: false, message: sq.error };
        const q = sq.data?.quote;
        return {
          success: true,
          message: `Swap quote: ${intent.amount} USDC → ~${q?.estimatedOutput || "?"} ETH`,
          data: sq.data,
        };

      case "help":
        return {
          success: true,
          message: `Aegis Bot Commands:\n\n• deposit — Get your BitGo custodial deposit address\n• balance — Check your USDC balance\n• Long $300 ETH 3x — Open long\n• Short $200 BTC — Open short\n• Close position — Close all open positions\n• Hedge $500 against inflation — Yield Shield\n• Show my portfolio — Positions & shields\n• Analyze my wallet — Risk analysis (HeyElsa)\n• Yield / Where to earn — Yield suggestions\n• Leaderboard — Top traders\n• link 0xYourAddress — Use your own wallet instead\n\nAll trades settle on-chain with verifiable tx hashes.`,
        };

      default:
        return {
          success: false,
          message: `Unknown command. Say "help" for options.`,
        };
    }
  } catch (err) {
    return { success: false, message: err.message || "Action failed" };
  }
}

async function getOrCreateCustodialWallet(phone) {
  const existing = await CustodialWallet.findOne({ phone }).lean();
  if (existing) {
    await CustodialWallet.updateOne({ phone }, { lastUsedAt: new Date() });

    // Sync latest on-chain balance
    let onChainBalance = 0;
    try {
      onChainBalance = await usdcBalanceService.getUsdcBalance(
        existing.receiveAddress,
      );
    } catch {}

    return {
      receiveAddress: existing.receiveAddress,
      isNew: false,
      walletId: existing.bitgoWalletId,
      onChainBalance,
    };
  }
  if (!bitgoCustodyService.isConfigured()) {
    return {
      error: "BitGo custodial wallets not configured. Use: link 0xYourAddress",
    };
  }
  const label = `AGS-${phone.replace(/\D/g, "").slice(-8)}`;
  // Create a BitGo v3 agent wallet on hteth testnet, with forwarder + policy hash.
  const {
    walletId,
    forwarderAddress,
    policyHash,
    walletVersion,
    nativePoliciesSet,
    userKeyPrv,
  } = await bitgoCustodyService.createAgentWallet({
    label,
    isTestnet: true,
  });

  const receiveAddress = forwarderAddress;
  if (!receiveAddress)
    throw new Error(
      "BitGo agent wallet created but no forwarder/deposit address",
    );

  if (userKeyPrv) {
    console.warn(
      "[BitGo Custody] userKeyPrv returned for wallet %s. Store this securely now; BitGo will not return it again.",
      walletId,
    );
  }

  await CustodialWallet.create({
    phone,
    bitgoWalletId: walletId,
    receiveAddress: receiveAddress.toLowerCase(),
    forwarderAddress: forwarderAddress
      ? forwarderAddress.toLowerCase()
      : undefined,
    walletVersion,
    policyHash,
    nativePoliciesSet,
    label,
  });
  await User.findOneAndUpdate(
    { address: receiveAddress.toLowerCase() },
    { $set: { lastActiveAt: new Date() } },
    { upsert: true },
  );
  return {
    receiveAddress: receiveAddress.toLowerCase(),
    isNew: true,
    walletId,
  };
}

async function processMessage(message, walletAddressOrPhone, options = {}) {
  const intent = await getIntent(message);

  // Handle link_wallet — caller (e.g. WhatsApp route) should persist the link
  if (intent.intent === "link_wallet" && intent.address) {
    return { intent: "link_wallet", address: intent.address, needsLink: true };
  }

  // Handle get_deposit_address — create or return BitGo custodial wallet (need phone)
  const isPhone =
    walletAddressOrPhone && !walletAddressOrPhone.startsWith("0x");
  if (intent.intent === "get_deposit_address" && isPhone) {
    try {
      const result = await getOrCreateCustodialWallet(walletAddressOrPhone);
      if (result.error) {
        return { success: false, message: result.error };
      }
      const explorerLink = explorerWalletUrl(result.receiveAddress);
      const usdcTokenLink = `${EXPLORER_BASE}/token/0x17b9526493820c6eb04988433b9220b06e210a3e`;
      const msg = result.isNew
        ? `✅ Your BitGo custodial wallet is ready.\n\n📥 Deposit address:\n${result.receiveAddress}\n\nSend USDC (Base Sepolia) to this address.\nUSDC Contract: ${usdcTokenLink}\n\nExplorer: ${explorerLink}\n\nOnce deposited, chat to trade — e.g. "Long $100 ETH 2x" or "Hedge $500 against inflation".`
        : `📥 Your deposit address:\n${result.receiveAddress}\n\nBalance: $${(result.onChainBalance || 0).toFixed(2)} USDC\nExplorer: ${explorerLink}\n\nSend USDC here to fund your account, then chat to trade.`;
      return {
        success: true,
        intent: "get_deposit_address",
        message: msg,
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        message: `Could not create wallet: ${err.message}`,
      };
    }
  }
  if (intent.intent === "get_deposit_address" && !isPhone) {
    return {
      success: false,
      message:
        'Send "deposit" from WhatsApp to get your custodial deposit address.',
    };
  }

  const address = await resolveWallet(walletAddressOrPhone);

  // Handle confirm_pending — use stored intent (e.g. create_shield)
  if (intent.intent === "confirm_pending" && isPhone) {
    const pending = getAndClearPendingConfirmation(walletAddressOrPhone);
    if (pending?.confirmIntent && address) {
      const result = await executeIntent(pending.confirmIntent, address, {
        confirm: true,
      });
      return { intent: "create_shield", ...result };
    }
    return {
      success: false,
      message: "Nothing to confirm. Try: Hedge $500 against inflation",
    };
  }

  const result = await executeIntent(intent, address, options);

  // Store pending for shield confirmation (WhatsApp needs to re-send with YES)
  if (result.needsConfirmation && result.confirmIntent && isPhone) {
    setPendingConfirmation(walletAddressOrPhone, {
      confirmIntent: result.confirmIntent,
    });
  }

  return { intent: intent.intent, ...result };
}

module.exports = {
  detectIntent,
  executeIntent,
  processMessage,
  hasPendingConfirmation,
  parseAsset,
  parseNumber,
  resolveWallet,
  getOrCreateCustodialWallet,
  setPendingConfirmation,
  getAndClearPendingConfirmation,
};
