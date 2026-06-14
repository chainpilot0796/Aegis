/**
 * End-to-end smoke for the agent-key system:
 *   1. Generate a throwaway wallet.
 *   2. Issue a nonce, sign it, create a key (raw key returned ONCE).
 *   3. Use the key + agent headers to call /api/ai/recommend-shield.
 *   4. Re-list the user's actions and confirm the call was recorded.
 *   5. Revoke the key, confirm next bearer call returns 401.
 */

const { ethers } = require('ethers');

const API = process.env.API_BASE || 'http://127.0.0.1:3001';
const ANSI = { ok: '\x1b[32m', fail: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' };
const tag = (ok) => (ok ? `${ANSI.ok}  PASS${ANSI.reset}` : `${ANSI.fail}  FAIL${ANSI.reset}`);

async function step(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    console.log(`${tag(true)}  ${name.padEnd(48)} ${Date.now() - start}ms  ${detail || ''}`);
    return true;
  } catch (err) {
    console.log(`${tag(false)}  ${name.padEnd(48)} ${Date.now() - start}ms  ${err.message || err}`);
    return false;
  }
}

async function postJson(path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function signedFlow(wallet, action, extra = {}) {
  const nonceResp = await postJson('/api/agents/nonce', {
    walletAddress: wallet.address,
    action,
  });
  const signature = await wallet.signMessage(nonceResp.message);
  return { signedBody: { walletAddress: wallet.address, signature, nonce: nonceResp.nonce, expiresAt: nonceResp.expiresAt, ...extra }, nonceResp };
}

(async () => {
  const wallet = ethers.Wallet.createRandom();
  console.log(`Throwaway wallet: ${wallet.address}\n`);

  let rawKey = null;
  let keyId = null;
  let allOk = true;

  allOk = await step('Create key (signed)', async () => {
    const { signedBody } = await signedFlow(wallet, 'create', { label: 'smoke-bot', scopes: ['recommend', 'read'] });
    const out = await postJson('/api/agents/keys', signedBody);
    rawKey = out.key;
    keyId = out.id;
    if (!rawKey || !rawKey.startsWith('aegis_sk_')) {
      throw new Error(`bad raw key shape: ${rawKey}`);
    }
    return `prefix=${out.keyPrefix} scopes=[${out.scopes.join(',')}]`;
  }) && allOk;

  allOk = await step('List keys returns the new key', async () => {
    const { signedBody } = await signedFlow(wallet, 'list');
    const out = await postJson('/api/agents/keys/list', signedBody);
    if (!Array.isArray(out.keys) || out.keys.length === 0) throw new Error('no keys returned');
    if (!out.keys.find((k) => k.id === keyId)) throw new Error('created key missing');
    return `n=${out.keys.length} status=${out.keys[0].status}`;
  }) && allOk;

  allOk = await step('Use bearer key to call /api/ai/recommend-shield', async () => {
    const out = await postJson('/api/ai/recommend-shield', {
      concern: 'I am worried about US housing prices in Miami',
      depositAmount: 500,
      durationMonths: 3,
    }, {
      Authorization: `Bearer ${rawKey}`,
      'X-Agent-Slug': 'conservative-saver',
      'X-Agent-Model': 'gpt-4o',
      'X-Agent-Name': 'Smoke Bot',
    });
    if (!out.recommendation?.asset) throw new Error('no recommendation.asset');
    return `asset=${out.recommendation.asset} provider=${out.recommendation.providerUsed}`;
  }) && allOk;

  // Give the fire-and-forget logger 250ms to flush
  await new Promise((r) => setTimeout(r, 500));

  allOk = await step('Action feed reflects the call', async () => {
    const url = new URL(`${API}/api/agents/actions/public`);
    url.searchParams.set('wallet', wallet.address.toLowerCase());
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.actions || j.actions.length === 0) throw new Error('action feed empty');
    const a = j.actions[0];
    if (a.action !== 'recommend') throw new Error(`top action is ${a.action}, expected recommend`);
    if (a.agentSlug !== 'conservative-saver') throw new Error(`bad agentSlug ${a.agentSlug}`);
    const agg = (j.agents || []).find((g) => g.agentSlug === 'conservative-saver');
    if (!agg) throw new Error('no aggregated agent row');
    return `actions=${j.actions.length} agents=${j.agents.length} agg.model=${agg.agentModel}`;
  }) && allOk;

  allOk = await step('Revoke the key', async () => {
    const { signedBody } = await signedFlow(wallet, 'revoke');
    await postJson(`/api/agents/keys/${keyId}/revoke`, signedBody);
    return 'ok';
  }) && allOk;

  allOk = await step('Revoked key now returns 401', async () => {
    try {
      await postJson('/api/ai/recommend-shield', { concern: 'test' }, { Authorization: `Bearer ${rawKey}` });
      throw new Error('expected 401, got 200');
    } catch (e) {
      if (e.status === 401) return 'correctly rejected';
      throw e;
    }
  }) && allOk;

  console.log('');
  console.log(allOk ? `${ANSI.ok}AGENT SMOKE PASSED${ANSI.reset}` : `${ANSI.fail}AGENT SMOKE FAILED${ANSI.reset}`);
  process.exit(allOk ? 0 : 1);
})();
