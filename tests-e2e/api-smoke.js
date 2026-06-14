/**
 * REST-layer smoke: hits the four key endpoints on the live local server.
 * Each call records pass/fail with the body excerpt.
 */
const API = process.env.API_BASE || 'http://127.0.0.1:3001';
const ANSI = { ok: '\x1b[32m', fail: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' };

function tag(ok) {
  return ok
    ? `${ANSI.ok}  PASS${ANSI.reset}`
    : `${ANSI.fail}  FAIL${ANSI.reset}`;
}

async function step(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    console.log(`${tag(true)}  ${name.padEnd(40)} ${Date.now() - start}ms  ${detail || ''}`);
    return true;
  } catch (err) {
    console.log(`${tag(false)}  ${name.padEnd(40)} ${Date.now() - start}ms  ${err.message}`);
    return false;
  }
}

(async () => {
  let allOk = true;
  let preparedRootHash = null;
  let preparedRecommendation = null;

  allOk = await step('GET  /api/sponsors/zerog', async () => {
    const r = await fetch(`${API}/api/sponsors/zerog`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.json();
    if (!body.storage?.initialized) throw new Error('storage not initialized');
    if (!body.compute?.initialized) throw new Error('compute not initialized');
    return `chain=${body.chain?.label} storage=ok compute=ok nim=${body.nimFallback?.configured}`;
  }) && allOk;

  allOk = await step('GET  /api/yield-shield/rates', async () => {
    const r = await fetch(`${API}/api/yield-shield/rates`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.json();
    if (!Array.isArray(body.rates) || body.rates.length === 0) throw new Error('no rates');
    return `top=${body.rates[0].protocol} ${body.rates[0].currentApy}%`;
  }) && allOk;

  allOk = await step('POST /api/ai/recommend-shield', async () => {
    const r = await fetch(`${API}/api/ai/recommend-shield`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concern: "I'm worried about inflation eating my savings",
        depositAmount: 1000,
        durationMonths: 3,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const body = await r.json();
    const rec = body.recommendation;
    if (!rec?.asset) throw new Error('no asset returned');
    preparedRecommendation = rec;
    return `asset=${rec.asset} provider=${rec.providerUsed} tee=${rec.teeVerified}`;
  }) && allOk;

  allOk = await step('POST /api/yield-shield/simulate', async () => {
    const r = await fetch(`${API}/api/yield-shield/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depositAmount: 1000, asset: 'gold', durationMonths: 3 }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const body = await r.json();
    if (!body.projection) throw new Error('no projection');
    return `apy=${body.projection.yieldApy}% scenarios=${body.projection.scenarios?.length}`;
  }) && allOk;

  allOk = await step('POST /api/yield-shield/prepare', async () => {
    const r = await fetch(`${API}/api/yield-shield/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: '0x4523095f3d872dD51aAB5c6428b513AF645C15B5',
        depositAmount: 100,
        asset: preparedRecommendation?.asset || 'gold',
        durationMonths: 3,
        teeInferenceSignature: preparedRecommendation?.teeChatId || null,
        teeInferenceProvider: preparedRecommendation?.teeProviderAddress || null,
        teeInferenceModel: preparedRecommendation?.teeModel || null,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const body = await r.json();
    const prep = body.prepare;
    if (!prep?.rootHash) throw new Error('no rootHash');
    preparedRootHash = prep.rootHash;
    return `rootHash=${prep.rootHash.slice(0, 18)}… provider=${prep.storageProvider} durationSec=${prep.durationSeconds}`;
  }) && allOk;

  if (preparedRootHash) {
    allOk = await step('GET  /api/yield-shield/doc/:rootHash', async () => {
      const r = await fetch(`${API}/api/yield-shield/doc/${preparedRootHash}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const body = await r.json();
      if (!body.markdown || body.markdown.length < 50) {
        throw new Error(`markdown too short (${body.markdown?.length || 0} chars)`);
      }
      return `md.len=${body.markdown.length} schema=${body.json?.schema}`;
    }) && allOk;
  }

  console.log('');
  console.log(allOk ? `${ANSI.ok}REST SMOKE PASSED${ANSI.reset}` : `${ANSI.fail}REST SMOKE FAILED${ANSI.reset}`);
  process.exit(allOk ? 0 : 1);
})();
