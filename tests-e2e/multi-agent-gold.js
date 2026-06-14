/**
 * Multi-agent gold demo.
 *
 * Runs four distinct agent personas one after the other. Each:
 *   - reuses the same user session key (1 user, many agents — the standard
 *     story in the skill manifest),
 *   - declares its own X-Agent-Slug / X-Agent-Model / X-Agent-Name,
 *   - calls recommend / simulate / prepare,
 *   - signs and submits createShield on 0G Aristotle mainnet,
 *   - persists via activate.
 *
 * Result: the /app/trade/gold page shows four separate rows with different
 * models, deposits, and reasons. Same wallet, different agents.
 *
 * Usage:
 *   AEGIS_USER_PRIVATE_KEY=<hex> node multi-agent-gold.js
 * (defaults to DEPLOYER_PRIVATE_KEY from ../contracts/.env if not set)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });
const { ethers } = require('ethers');

const API   = process.env.API_BASE || 'http://127.0.0.1:3001';
const RPC   = process.env.ZG_MAINNET_RPC || 'https://evmrpc.0g.ai';
const VAULT = '0x60403dd3CC683F65Db6dEb8597051aDc80506C3F';
const AUSDC = '0xA3CD4843Fc8f2Af53fa4786b16F70c90BfecD2F2';
const EXP   = 'https://chainscan.0g.ai';

const AUSDC_ABI = [
  'function faucet(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];
const VAULT_ABI = [
  'function createShield(uint128 deposit, uint64 durationSeconds, bytes32 assetId, uint64 entryPrice, bytes32 storageRootHash) external returns (uint256)',
  'event ShieldCreated(address indexed user, uint256 indexed idx, bytes32 indexed assetId, uint128 deposit, uint64 durationSeconds, uint64 entryPrice, bytes32 storageRootHash)',
];

// Four distinct agent profiles. All target gold via concerns that map to it.
const PROFILES = [
  {
    slug:    'conservative-saver',
    model:   'claude-opus-4-7',
    name:    'Treasury Steward',
    concern: 'My family has $250 of emergency savings I refuse to lose. Inflation worries me more than missing upside; please use a precious-metal hedge for a few months.',
    deposit: 25,
    durationMonths: 3,
  },
  {
    slug:    'inflation-hedger',
    model:   'gpt-4o',
    name:    'Inflation Sentinel',
    concern: 'Central banks keep printing and my purchasing power is eroding. I want a 6-month gold hedge on $40.',
    deposit: 40,
    durationMonths: 6,
  },
  {
    slug:    'balanced',
    model:   'meta/llama-3.3-70b-instruct',
    name:    'Balance Bot',
    concern: 'I want a balanced 3-month hedge with precious-metal exposure. $30 deposit.',
    deposit: 30,
    durationMonths: 3,
  },
  {
    slug:    'gold-momentum-custom',
    model:   'deepseek-r1-70b',
    name:    'Gold Maverick',
    concern: 'Gold has been trending up; I want a 1-month exposure on $20.',
    deposit: 20,
    durationMonths: 1,
    forceAsset: 'gold', // explicit override for our custom slug
  },
];

const ANSI = { ok: '\x1b[32m', dim: '\x1b[2m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };

async function postJson(p, body, headers = {}) {
  const res = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  return j;
}

async function ensureSessionKey(wallet) {
  // Mint one fresh key for this run; agents share it (one user, many agents).
  const nonce = await postJson('/api/agents/nonce', {
    walletAddress: wallet.address,
    action: 'create',
  });
  const signature = await wallet.signMessage(nonce.message);
  const out = await postJson('/api/agents/keys', {
    walletAddress: wallet.address,
    nonce: nonce.nonce,
    expiresAt: nonce.expiresAt,
    signature,
    label: 'multi-agent-gold-demo',
    scopes: ['recommend', 'shield', 'read'],
  });
  return out.key;
}

async function runProfile(profile, key, wallet) {
  const headers = {
    Authorization: `Bearer ${key}`,
    'X-Agent-Slug':  profile.slug,
    'X-Agent-Model': profile.model,
    'X-Agent-Name':  profile.name,
  };

  console.log(`\n${ANSI.cyan}>>> ${profile.name} (${profile.slug} · ${profile.model})${ANSI.reset}`);
  console.log(`    concern: ${profile.concern.slice(0, 80)}…`);

  // 1. recommend
  const rec = await postJson(
    '/api/ai/recommend-shield',
    {
      concern: profile.concern,
      depositAmount: profile.deposit,
      durationMonths: profile.durationMonths,
    },
    headers,
  );
  let asset = rec.recommendation?.asset || 'gold';
  if (profile.forceAsset) asset = profile.forceAsset;
  if (asset !== 'gold') {
    // Force gold for the demo (some strategies wouldn't have picked it organically).
    console.log(`    asset returned ${asset}; overriding to gold for demo`);
    asset = 'gold';
  }
  console.log(`    ${ANSI.ok}recommend${ANSI.reset} -> ${asset} (provider=${rec.recommendation?.providerUsed})`);

  // 2. prepare (uploads to 0G Storage)
  const prepResp = await postJson(
    '/api/yield-shield/prepare',
    {
      address: wallet.address,
      depositAmount: profile.deposit,
      asset,
      durationMonths: profile.durationMonths,
      teeInferenceSignature: rec.recommendation?.teeChatId || null,
      teeInferenceProvider:  rec.recommendation?.teeProviderAddress || null,
      teeInferenceModel:     rec.recommendation?.teeModel || null,
    },
    headers,
  );
  const prep = prepResp.prepare;
  if (!prep?.rootHash) throw new Error('prepare returned no rootHash');
  console.log(`    ${ANSI.ok}prepare  ${ANSI.reset} -> rootHash=${prep.rootHash.slice(0, 18)}…`);

  // 3. on-chain createShield
  const ausdc = new ethers.Contract(AUSDC, AUSDC_ABI, wallet);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const depositWei = ethers.parseUnits(String(profile.deposit), 6);

  const cur = await ausdc.balanceOf(wallet.address);
  if (cur < depositWei) {
    const tx = await ausdc.faucet(wallet.address, ethers.parseUnits('1000', 6));
    await tx.wait();
  }
  const atx = await ausdc.approve(VAULT, depositWei);
  await atx.wait();

  const ctx = await vault.createShield(
    depositWei,
    BigInt(prep.durationSeconds),
    prep.assetIdBytes32,
    BigInt(prep.entryPriceScaled),
    prep.rootHash,
  );
  const rcpt = await ctx.wait();
  const iface = new ethers.Interface(VAULT_ABI);
  let idx = null;
  for (const log of rcpt.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'ShieldCreated') {
        idx = Number(parsed.args.idx);
        break;
      }
    } catch {}
  }
  console.log(`    ${ANSI.ok}createShield${ANSI.reset} -> tx=${ctx.hash.slice(0, 18)}… idx=${idx}`);

  // 4. activate
  await postJson(
    '/api/yield-shield/activate',
    {
      address: wallet.address,
      depositAmount: profile.deposit,
      asset,
      durationMonths: profile.durationMonths,
      prepare: prep,
      onChainTxHash: ctx.hash,
      onChainIdx: idx,
      teeInferenceSignature: rec.recommendation?.teeChatId || null,
      teeInferenceProvider:  rec.recommendation?.teeProviderAddress || null,
      teeInferenceModel:     rec.recommendation?.teeModel || null,
      teeInferenceVerified:  rec.recommendation?.teeVerified === true,
    },
    headers,
  );
  console.log(`    ${ANSI.ok}activate ${ANSI.reset} -> persisted`);

  return {
    profile,
    asset,
    deposit: profile.deposit,
    rootHash: prep.rootHash,
    onChainTxHash: ctx.hash,
    onChainIdx: idx,
    explorerTx: `${EXP}/tx/${ctx.hash}`,
    providerUsed: rec.recommendation?.providerUsed,
  };
}

(async () => {
  const rawKey = process.env.AEGIS_USER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!rawKey) throw new Error('private key missing');
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(rawKey.startsWith('0x') ? rawKey : '0x' + rawKey, provider);
  const net = await provider.getNetwork();
  console.log('========================================');
  console.log(' Multi-agent gold demo on 0G Aristotle');
  console.log('========================================');
  console.log('user wallet :', wallet.address);
  console.log('chain id    :', net.chainId.toString());
  console.log('native bal  :', ethers.formatEther(await provider.getBalance(wallet.address)), '0G');

  const key = await ensureSessionKey(wallet);
  console.log('session key :', key.slice(0, 22) + '…');

  const results = [];
  for (const p of PROFILES) {
    try {
      results.push(await runProfile(p, key, wallet));
    } catch (e) {
      console.error(`    ${ANSI.red}FAIL${ANSI.reset} ${p.slug}: ${e.message}`);
      results.push({ profile: p, error: e.message });
    }
  }

  console.log('\n========================================');
  console.log(' Summary');
  console.log('========================================');
  for (const r of results) {
    if (r.error) {
      console.log(`  ${ANSI.red}FAIL${ANSI.reset} ${r.profile.slug.padEnd(22)} ${r.error}`);
    } else {
      console.log(
        `  ${ANSI.ok}OK${ANSI.reset}   ${r.profile.slug.padEnd(22)} idx=${String(r.onChainIdx).padStart(2)} dep=$${String(r.deposit).padStart(3)} provider=${(r.providerUsed || '?').padEnd(6)} tx=${r.explorerTx}`
      );
    }
  }
  console.log('========================================');
  console.log(`Open: ${API.replace(':3001', ':5173')}/app/trade/gold`);
  console.log(`     ${API}/api/agents/actions/public?wallet=${wallet.address.toLowerCase()}&asset=gold`);
})().catch((e) => { console.error('TOP:', e); process.exit(1); });
