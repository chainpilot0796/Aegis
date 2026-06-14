/**
 * Aegis.0G — live mainnet agent flow.
 *
 * Drives the full end-to-end pipeline using the deployer wallet as BOTH the
 * user and the agent (just for the demo — in real life they'd be separate
 * wallets sharing a session key).
 *
 *   1. Sign a nonce + create a session key as the user.
 *   2. Use the key + agent headers to call /api/ai/recommend-shield.
 *   3. Call /api/yield-shield/prepare to upload the agreement to 0G Storage.
 *   4. Submit AegisVault.createShield on 0G Aristotle MAINNET (real on-chain tx).
 *   5. Call /api/yield-shield/activate to persist the Shield record.
 *   6. Confirm the action appears in /api/agents/actions/public and /api/leaderboard.
 *   7. Print a summary including all chainscan.0g.ai links.
 *
 * Usage:  node mainnet-flow.js
 * Env required: DEPLOYER_PRIVATE_KEY in ../contracts/.env (or override
 *               with AEGIS_USER_PRIVATE_KEY in the local env).
 */

const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', 'contracts', '.env'),
});

const { ethers } = require('ethers');
const fs = require('fs');

const API   = process.env.API_BASE || 'http://127.0.0.1:3001';
const RPC   = process.env.ZG_MAINNET_RPC || 'https://evmrpc.0g.ai';
const CHAIN = 16661;

const VAULT = '0x60403dd3CC683F65Db6dEb8597051aDc80506C3F';
const AUSDC = '0xA3CD4843Fc8f2Af53fa4786b16F70c90BfecD2F2';
const EXPLORER = 'https://chainscan.0g.ai';

const ANSI = { ok: '\x1b[32m', fail: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' };
const tag = (ok) => (ok ? `${ANSI.ok}  PASS${ANSI.reset}` : `${ANSI.fail}  FAIL${ANSI.reset}`);

async function step(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    console.log(`${tag(true)}  ${name.padEnd(54)} ${Date.now() - start}ms  ${detail || ''}`);
    return true;
  } catch (err) {
    console.log(`${tag(false)}  ${name.padEnd(54)} ${Date.now() - start}ms  ${err.message || err}`);
    throw err;
  }
}

async function postJson(p, body, headers = {}) {
  const res = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!res.ok) { const e = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`); e.status = res.status; e.body = j; throw e; }
  return j;
}

const AUSDC_ABI = [
  'function faucet(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const VAULT_ABI = [
  'function createShield(uint128 deposit, uint64 durationSeconds, bytes32 assetId, uint64 entryPrice, bytes32 storageRootHash) external returns (uint256)',
  'function getShieldCount(address user) view returns (uint256)',
  'function totalShieldsCreated() view returns (uint256)',
  'event ShieldCreated(address indexed user, uint256 indexed idx, bytes32 indexed assetId, uint128 deposit, uint64 durationSeconds, uint64 entryPrice, bytes32 storageRootHash)',
];

async function main() {
  const rawKey = process.env.AEGIS_USER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!rawKey) throw new Error('DEPLOYER_PRIVATE_KEY missing');
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(rawKey.startsWith('0x') ? rawKey : '0x' + rawKey, provider);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN) {
    throw new Error(`provider on chain ${net.chainId}, expected ${CHAIN}`);
  }

  console.log('========================================');
  console.log(' Aegis.0G mainnet flow — full agent invest');
  console.log('========================================');
  console.log(`user/wallet  : ${wallet.address}`);
  console.log(`chain        : 0G Aristotle (${CHAIN})`);
  const bal = await provider.getBalance(wallet.address);
  console.log(`native bal   : ${ethers.formatEther(bal)} 0G`);
  console.log('');

  let sessionKey = null;
  let recommendation = null;
  let prepare = null;
  let createTx = null;
  let shieldIdx = null;

  // 1. Create an Aegis session key for this wallet
  await step('Sign nonce + create agent session key', async () => {
    const nonceResp = await postJson('/api/agents/nonce', { walletAddress: wallet.address, action: 'create' });
    const signature = await wallet.signMessage(nonceResp.message);
    const out = await postJson('/api/agents/keys', {
      walletAddress: wallet.address,
      nonce: nonceResp.nonce,
      expiresAt: nonceResp.expiresAt,
      signature,
      label: 'mainnet-demo-bot',
      scopes: ['recommend', 'shield', 'read'],
    });
    sessionKey = out.key;
    return `prefix=${out.keyPrefix} id=${out.id}`;
  });

  // 2. Recommend a shield via the bearer + agent headers
  await step('Agent calls /api/ai/recommend-shield', async () => {
    const out = await postJson(
      '/api/ai/recommend-shield',
      { concern: 'I am worried about inflation eating my savings', depositAmount: 50, durationMonths: 3 },
      {
        Authorization: `Bearer ${sessionKey}`,
        'X-Agent-Slug': 'inflation-hedger',
        'X-Agent-Model': 'gpt-4o',
        'X-Agent-Name': 'Mainnet Demo Bot',
      },
    );
    recommendation = out.recommendation;
    return `asset=${recommendation.asset} provider=${recommendation.providerUsed} tee=${recommendation.teeVerified}`;
  });

  // 3. Prepare — uploads the agreement doc to 0G Storage, returns on-chain args
  await step('Agent calls /api/yield-shield/prepare (uploads to 0G Storage)', async () => {
    const out = await postJson(
      '/api/yield-shield/prepare',
      {
        address: wallet.address,
        depositAmount: 50,
        asset: recommendation.asset,
        durationMonths: 3,
        teeInferenceSignature: recommendation.teeChatId,
        teeInferenceProvider:  recommendation.teeProviderAddress,
        teeInferenceModel:     recommendation.teeModel,
      },
      {
        Authorization: `Bearer ${sessionKey}`,
        'X-Agent-Slug': 'inflation-hedger',
        'X-Agent-Model': 'gpt-4o',
        'X-Agent-Name': 'Mainnet Demo Bot',
      },
    );
    prepare = out.prepare;
    if (!prepare?.rootHash) throw new Error('no rootHash');
    return `rootHash=${prepare.rootHash.slice(0, 18)}… provider=${prepare.storageProvider}`;
  });

  // 4. On-chain — top up A-USDC if needed, approve, createShield (REAL MAINNET TX)
  const ausdc = new ethers.Contract(AUSDC, AUSDC_ABI, wallet);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const depositWei = ethers.parseUnits('50', 6); // 50 A-USDC

  await step('Top up A-USDC if balance < 50', async () => {
    const cur = await ausdc.balanceOf(wallet.address);
    if (cur >= depositWei) return `balance=${ethers.formatUnits(cur, 6)} (sufficient)`;
    const tx = await ausdc.faucet(wallet.address, ethers.parseUnits('1000', 6));
    await tx.wait();
    return `faucet tx=${tx.hash.slice(0, 18)}…`;
  });

  await step('Approve AegisVault to pull A-USDC', async () => {
    const tx = await ausdc.approve(VAULT, depositWei);
    await tx.wait();
    return `tx=${tx.hash.slice(0, 18)}…`;
  });

  await step('Submit createShield on 0G Aristotle MAINNET', async () => {
    const tx = await vault.createShield(
      depositWei,
      BigInt(prepare.durationSeconds),
      prepare.assetIdBytes32,
      BigInt(prepare.entryPriceScaled),
      prepare.rootHash,
    );
    const receipt = await tx.wait();
    createTx = tx.hash;
    // Parse the ShieldCreated event for the idx
    const iface = new ethers.Interface(VAULT_ABI);
    for (const log of receipt.logs || []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'ShieldCreated') {
          shieldIdx = Number(parsed.args.idx);
          break;
        }
      } catch {}
    }
    return `tx=${tx.hash.slice(0, 18)}… block=${receipt.blockNumber} idx=${shieldIdx}`;
  });

  // 5. Persist the Shield record server-side
  await step('Agent calls /api/yield-shield/activate', async () => {
    const out = await postJson(
      '/api/yield-shield/activate',
      {
        address: wallet.address,
        depositAmount: 50,
        asset: recommendation.asset,
        durationMonths: 3,
        prepare,
        onChainTxHash: createTx,
        onChainIdx: shieldIdx,
        teeInferenceSignature: recommendation.teeChatId,
        teeInferenceProvider:  recommendation.teeProviderAddress,
        teeInferenceModel:     recommendation.teeModel,
        teeInferenceVerified:  recommendation.teeVerified === true,
      },
      {
        Authorization: `Bearer ${sessionKey}`,
        'X-Agent-Slug': 'inflation-hedger',
        'X-Agent-Model': 'gpt-4o',
        'X-Agent-Name': 'Mainnet Demo Bot',
      },
    );
    return `shieldId=${out.shield?._id || '?'} stored=${out.shield?.storageProvider || '?'}`;
  });

  // Let the fire-and-forget action logger flush
  await new Promise((r) => setTimeout(r, 700));

  // 6. Verify the agent activity feed contains this action
  await step('Verify /api/agents/actions/public reflects the call', async () => {
    const url = new URL(`${API}/api/agents/actions/public`);
    url.searchParams.set('wallet', wallet.address.toLowerCase());
    url.searchParams.set('asset', recommendation.asset);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const agg = (j.agents || []).find((g) => g.agentSlug === 'inflation-hedger');
    if (!agg) throw new Error('no agg row for inflation-hedger');
    return `actions=${j.actions.length} aggInvested=${agg.invested} agg.lastAction=${agg.lastAction}`;
  });

  // 7. Verify leaderboard sees this user with non-zero PnL field
  await step('Verify /api/leaderboard sees this user', async () => {
    const res = await fetch(`${API}/api/leaderboard`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const me = (j.leaderboard || []).find((r) => r.address.toLowerCase() === wallet.address.toLowerCase());
    if (!me) throw new Error('user missing from leaderboard');
    return `rank=${me.rank} totalPnl=$${me.totalPnl} shields=${me.shields} winRate=${me.winRate}%`;
  });

  console.log('');
  console.log('========================================');
  console.log('  Full flow PASSED on MAINNET');
  console.log('========================================');
  console.log(`Recommendation : ${recommendation.asset} (${recommendation.providerUsed})`);
  console.log(`Storage rootHash: ${prepare.rootHash}`);
  console.log(`Doc fetch URL  : ${API}/api/yield-shield/doc/${prepare.rootHash}`);
  console.log(`Chain tx       : ${EXPLORER}/tx/${createTx}`);
  console.log(`Vault address  : ${EXPLORER}/address/${VAULT}`);
  console.log(`Shield idx     : ${shieldIdx} (for user ${wallet.address})`);
  console.log('========================================');

  // Persist a small artifact for the video script + storyboard to reference
  const artifactPath = path.join(__dirname, 'last-mainnet-flow.json');
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        user: wallet.address,
        chainId: CHAIN,
        vault: VAULT,
        ausdc: AUSDC,
        asset: recommendation.asset,
        providerUsed: recommendation.providerUsed,
        teeVerified: recommendation.teeVerified,
        teeProviderAddress: recommendation.teeProviderAddress,
        teeModel: recommendation.teeModel,
        prepare: { rootHash: prepare.rootHash, storageProvider: prepare.storageProvider, storageTxHash: prepare.storageTxHash },
        createTx,
        shieldIdx,
        explorerTx: `${EXPLORER}/tx/${createTx}`,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`Artifact saved to ${artifactPath}`);
}

main().catch((e) => {
  console.error('\nFLOW FAILED:', e.message || e);
  process.exit(1);
});
