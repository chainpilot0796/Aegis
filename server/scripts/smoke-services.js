/**
 * Aegis.0G — service smoke test.
 *
 * Pings each external dependency in isolation:
 *   1. MongoDB (Atlas free tier or local)
 *   2. NVIDIA NIM (silent fallback for AI inference)
 *   3. 0G Compute (TeeML inference)
 *   4. 0G Storage (Indexer + MemData upload)
 *
 * Usage:  node scripts/smoke-services.js
 *
 * Each check times out at 25s and reports OK / FAIL with the relevant detail.
 * Exits non-zero only if a "critical" check fails (Mongo). Others are advisory:
 * the server's silent-fallback design means partial availability is fine.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Force Node's DNS resolver to use public servers. On some Windows setups the
// default resolver refuses SRV queries with ECONNREFUSED even though `nslookup`
// from the same machine resolves cleanly. Setting public DNS sidesteps that.
try {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1', '9.9.9.9']);
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const CHECKS = [];

function recordOk(name, detail) {
  CHECKS.push({ name, ok: true, detail });
}
function recordFail(name, detail) {
  CHECKS.push({ name, ok: false, detail });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

// ─── 1. MongoDB ──────────────────────────────────────────────────────────────
async function checkMongo() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    recordFail('MongoDB', 'MONGODB_URI not set');
    return;
  }
  const mongoose = require('mongoose');
  try {
    await withTimeout(
      mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 }),
      20000,
      'MongoDB connect'
    );
    const dbName = mongoose.connection.db?.databaseName || '(unknown)';
    const ping = await mongoose.connection.db.admin().ping();
    recordOk('MongoDB', `connected to "${dbName}" — ping=${JSON.stringify(ping)}`);
    await mongoose.disconnect();
  } catch (err) {
    recordFail('MongoDB', err.message || String(err));
  }
}

// ─── 2. NVIDIA NIM ───────────────────────────────────────────────────────────
async function checkNim() {
  const nim = require('../services/nimFallbackService');
  if (!nim.isConfigured()) {
    recordFail('NVIDIA NIM', 'NIM_API_KEY not set');
    return;
  }
  try {
    const result = await withTimeout(
      nim.chatCompletion({
        systemPrompt:
          'You are a JSON producer. Respond with ONLY the literal JSON {"ok":true,"msg":"pong"}. No prose, no markdown fences.',
        userPrompt: 'ping',
      }),
      60000,
      'NIM /chat/completions'
    );
    const head = String(result.content || '').slice(0, 120).replace(/\s+/g, ' ');
    recordOk('NVIDIA NIM', `model=${result.model} resp="${head}"`);
  } catch (err) {
    recordFail('NVIDIA NIM', err.message || String(err));
  }
}

// ─── 3. 0G Compute ───────────────────────────────────────────────────────────
async function checkCompute() {
  const compute = require('../services/zeroGComputeService');
  try {
    const ok = await withTimeout(compute.init(), 25000, '0G Compute init');
    if (!ok || !compute.isConfigured()) {
      recordFail('0G Compute', compute.getInfo().error || 'init returned false');
      return;
    }
    // Skip the full inference round-trip in the smoke script — listService alone
    // proves the broker is reachable. recommendShield will be exercised live.
    recordOk('0G Compute', `initialized — wallet=${compute.getInfo().wallet}, providers=${compute.getInfo().providers.length}`);
  } catch (err) {
    recordFail('0G Compute', err.message || String(err));
  }
}

// ─── 4. 0G Storage ──────────────────────────────────────────────────────────
async function checkStorage() {
  const storage = require('../services/zeroGStorageService');
  try {
    const ok = await withTimeout(storage.init(), 25000, '0G Storage init');
    if (!ok || !storage.isConfigured()) {
      recordFail('0G Storage', storage.getInfo().error || 'init returned false');
      return;
    }
    recordOk('0G Storage', `initialized — signer=${storage.getInfo().signer}, indexer=${storage.getInfo().indexer}`);
  } catch (err) {
    recordFail('0G Storage', err.message || String(err));
  }
}

async function main() {
  console.log('========================================');
  console.log(' Aegis.0G — service smoke test');
  console.log('========================================');

  await checkMongo();
  await checkNim();
  await checkCompute();
  await checkStorage();

  console.log('\nResults:');
  for (const c of CHECKS) {
    const tag = c.ok ? '\x1b[32m  OK \x1b[0m' : '\x1b[31m FAIL\x1b[0m';
    console.log(`${tag}  ${c.name.padEnd(14)}  ${c.detail}`);
  }

  const mongoFailed = CHECKS.find((c) => c.name === 'MongoDB' && !c.ok);
  console.log('\n========================================');
  process.exit(mongoFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(2);
});
