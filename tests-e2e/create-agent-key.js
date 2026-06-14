/**
 * Creates a fresh Aegis session key for the demo agent to use.
 * Prints the raw key (returned once by the API) so the subagent can pick it up.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });
const { ethers } = require('ethers');

const API = process.env.API_BASE || 'http://127.0.0.1:3001';
const RPC = process.env.ZG_MAINNET_RPC || 'https://evmrpc.0g.ai';

async function postJson(p, body) {
  const r = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  return j;
}

(async () => {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY missing');
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider);

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
    label: 'real-llm-agent-demo',
    scopes: ['recommend', 'shield', 'read'],
  });

  console.log(JSON.stringify({
    key: out.key,
    keyPrefix: out.keyPrefix,
    id: out.id,
    walletAddress: wallet.address,
  }, null, 2));
})();
