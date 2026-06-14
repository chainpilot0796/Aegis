/**
 * Aegis.0G demo recording — REAL MetaMask, manual approvals.
 *
 * Strategy: Playwright drives the deterministic dapp navigation in headed mode
 * with the bundled MetaMask 13.13.1 extension pre-loaded. When a MetaMask
 * popup appears (connect, approve, send tx) the script pauses with an
 * on-screen + console hint; the human clicks Approve in real time; the
 * recording captures everything as a single .webm.
 *
 * Two modes:
 *   node record-real-mm.js setup     — first-time profile setup, no recording.
 *                                      You import your wallet + add the 0G chain.
 *   node record-real-mm.js record    — the recording run.
 *
 * On Windows. The persistent profile lives in tests-e2e/.mm-profile/.
 * Delete that dir to start over.
 */

const path = require('path');
const fs   = require('fs');
const { chromium } = require('playwright');
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });

const EXT_DIR     = path.join(__dirname, '.cache-synpress', 'metamask-chrome-13.13.1');
const PROFILE_DIR = path.join(__dirname, '.mm-profile');
const REC_DIR     = path.join(__dirname, 'recordings');
fs.mkdirSync(REC_DIR, { recursive: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

if (!fs.existsSync(EXT_DIR)) {
  console.error(`MetaMask extension not found at ${EXT_DIR}`);
  console.error(`Run the synpress cache builder first or extract MetaMask 13.13.1 there.`);
  process.exit(1);
}

const MODE = (process.argv[2] || 'record').toLowerCase();
if (!['setup', 'record'].includes(MODE)) {
  console.error('usage: node record-real-mm.js [setup|record]');
  process.exit(2);
}

const PROFILE_READY = fs.existsSync(path.join(PROFILE_DIR, '.aegis-profile-ready'));

const CLIENT = process.env.CLIENT_BASE || 'http://127.0.0.1:5173';

async function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function smoothScroll(page, totalMs, dy) {
  const steps = Math.max(1, Math.ceil(totalMs / 16));
  const step = dy / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'auto' }), step);
    await pause(16);
  }
}

async function inlineBanner(page, message, color = '#A78BFA') {
  await page.evaluate(({ message, color }) => {
    let el = document.getElementById('aegis-rec-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aegis-rec-banner';
      el.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(7,7,12,0.95); color: white;
        border: 2px solid ${color};
        border-radius: 12px; padding: 12px 20px;
        font-family: 'Geist Mono', monospace; font-size: 13px;
        z-index: 999999; pointer-events: none;
        box-shadow: 0 8px 30px rgba(167,139,250,0.35);
        max-width: 80vw; text-align: center;
      `;
      document.body.appendChild(el);
    }
    el.style.borderColor = color;
    el.textContent = message;
  }, { message, color });
  console.log(`>>> ${message}`);
}

async function hideBanner(page) {
  await page.evaluate(() => {
    const el = document.getElementById('aegis-rec-banner');
    if (el) el.remove();
  }).catch(() => {});
}

async function waitForAnyPageClose(context, label, timeoutMs = 90_000) {
  console.log(`    [waiting up to ${timeoutMs / 1000}s for ${label} popup to close]`);
  const initial = context.pages().length;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (context.pages().length < initial) return true;
    await pause(500);
  }
  return false;
}

(async () => {
  const recording = MODE === 'record';
  console.log('========================================');
  console.log(' Aegis.0G real-MetaMask recording');
  console.log('========================================');
  console.log('mode             :', MODE);
  console.log('profile dir      :', PROFILE_DIR);
  console.log('profile ready    :', PROFILE_READY);
  console.log('extension dir    :', EXT_DIR);
  console.log('recording output :', recording ? REC_DIR : '(none — setup mode)');
  console.log('');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 768 },
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    recordVideo: recording ? { dir: REC_DIR, size: { width: 1366, height: 768 } } : undefined,
  });

  if (MODE === 'setup') {
    console.log('Opening browser. Complete the MetaMask onboarding in the side panel:');
    console.log('  1. Click "I accept the terms of use" / "Import an existing wallet"');
    console.log('  2. Choose "Import using Secret Recovery Phrase" or "Import an account → private key"');
    console.log('     (private key import lives under the account menu after initial seed onboarding)');
    console.log('  3. Add the 0G Aristotle network manually:');
    console.log('       Network name : 0G Aristotle');
    console.log('       RPC URL      : https://evmrpc.0g.ai');
    console.log('       Chain ID     : 16661');
    console.log('       Currency     : 0G');
    console.log('       Explorer     : https://chainscan.0g.ai');
    console.log('  4. Switch to the 0G Aristotle network in MetaMask.');
    console.log('  5. When done, press Ctrl+C in this terminal to save the profile and exit.');
    console.log('');
    console.log('The profile is saved in the dir above; subsequent `record` runs reuse it.');

    // Open a blank page just to keep the context alive
    const blank = await context.newPage();
    await blank.goto('about:blank');

    // Wait for Ctrl+C
    await new Promise((resolve) => {
      process.on('SIGINT', resolve);
      process.on('SIGTERM', resolve);
    });

    // Mark profile as ready
    fs.writeFileSync(path.join(PROFILE_DIR, '.aegis-profile-ready'), new Date().toISOString());
    console.log('\nProfile saved. You can now run: node record-real-mm.js record');
    await context.close();
    process.exit(0);
  }

  if (!PROFILE_READY) {
    console.warn('Profile not marked ready — onboarding may still be needed. Run with `setup` first.');
  }

  // ───── Recording run ────────────────────────────────────────────────
  const page = await context.newPage();

  // ── Beat 1: Landing page scroll ──────────────────────────────────
  console.log('Beat 1: Landing scroll');
  await page.goto(CLIENT + '/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await pause(2500);
  await smoothScroll(page, 5000, 1800);
  await pause(1500);
  await smoothScroll(page, 4500, 2200);
  await pause(1500);
  await smoothScroll(page, 800, -window?.scrollY || -3000);

  // ── Beat 2: Open the dapp + connect wallet ───────────────────────
  console.log('Beat 2: Connect wallet');
  await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(2500);

  // Click "Connect Wallet" — RainbowKit opens its modal
  for (const sel of [
    'button:has-text("Connect Wallet")',
    'button:has-text("CONNECT WALLET")',
    'button:has-text("Connect")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 2000 }); break; } catch {}
    }
  }
  await pause(1500);

  // Pick MetaMask in RainbowKit's modal
  await inlineBanner(page, '👉 Pick MetaMask in the modal, then click Connect in the popup');
  for (const sel of [
    'button:has-text("MetaMask")',
    '[data-testid*="rk-wallet-option"]:has-text("MetaMask")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 2000 }); break; } catch {}
    }
  }
  // Wait for MetaMask popup window to open then close (= user approved)
  await waitForAnyPageClose(context, 'MetaMask connect', 90_000);
  await hideBanner(page);
  await pause(2000);

  // ── Beat 3: Shield page — recommendation ─────────────────────────
  console.log('Beat 3: Recommendation');
  await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(2500);

  const concernInput = page.locator(
    'input[placeholder*="worried"], input[placeholder*="inflation"], textarea[placeholder*="worried"]'
  ).first();
  if (await concernInput.count()) {
    try {
      await concernInput.click({ timeout: 2000 });
      await page.keyboard.type("I'm worried about inflation eating my savings.", { delay: 30 });
      await pause(700);
      const recBtn = page.locator('button:has-text("Get recommendation")').first();
      if (await recBtn.count()) {
        await recBtn.click();
        await pause(10000); // wait for the AI roundtrip
      }
    } catch (e) {
      console.warn('  Recommendation step skipped:', e.message);
    }
  }
  await pause(1500);
  await smoothScroll(page, 2000, 600);

  // Set deposit amount + duration if visible
  const amountInput = page.locator('input[type="number"]').first();
  if (await amountInput.count()) {
    try {
      await amountInput.click({ timeout: 2000 });
      await page.keyboard.type('25', { delay: 30 });
    } catch {}
  }

  await pause(2000);

  // ── Beat 4: Activate the shield ──────────────────────────────────
  console.log('Beat 4: Activate shield');
  await inlineBanner(page, 'Scrolling to the activate button…', '#00E5D4');
  await smoothScroll(page, 1500, 700);
  await pause(1000);

  // Hit any "Activate" / "Start earning" CTA
  for (const sel of [
    'button:has-text("Activate")',
    'button:has-text("Show my potential")',
    'button:has-text("Start earning")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 2000 }); break; } catch {}
    }
  }
  await pause(2000);

  // The activate flow can issue up to three MetaMask popups in order:
  //   1. AUSDC.faucet (only if balance < deposit)
  //   2. AUSDC.approve
  //   3. AegisVault.createShield
  // Pause at each. The user clicks Approve in MetaMask; we detect popup close.
  for (const label of ['Approve (faucet OR approve)', 'Approve (approve OR createShield)', 'Approve createShield']) {
    await inlineBanner(page, `👉 ${label} in MetaMask`, '#00E5D4');
    const closed = await waitForAnyPageClose(context, label, 120_000);
    if (!closed) {
      console.warn(`  Did not detect ${label} popup close within timeout; continuing anyway.`);
    }
    await pause(2500);
  }
  await hideBanner(page);

  // Wait for success screen
  await pause(8000);
  await smoothScroll(page, 1500, 500);
  await pause(2000);

  // ── Beat 5: Trade page — agent feed ──────────────────────────────
  console.log('Beat 5: Trade page agent feed');
  await page.goto(CLIENT + '/app/trade/gold', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(4000);
  await smoothScroll(page, 4000, 1200);
  await pause(2500);

  // ── Beat 6: Leaderboard ──────────────────────────────────────────
  console.log('Beat 6: Leaderboard');
  await page.goto(CLIENT + '/app/leaderboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(3500);

  console.log('Closing context, flushing video…');
  await context.close();

  // Move newest webm into a stable filename
  const webms = fs.readdirSync(REC_DIR).filter((f) => f.endsWith('.webm'));
  let best = null, bestBytes = 0;
  for (const f of webms) {
    const p = path.join(REC_DIR, f);
    const b = fs.statSync(p).size;
    if (b > bestBytes) { bestBytes = b; best = p; }
  }
  if (best) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newName = path.join(REC_DIR, `aegis-demo-real-mm-${stamp}.webm`);
    fs.renameSync(best, newName);
    console.log(`Video: ${newName} (${Math.round(bestBytes / 1024)} KB)`);
    console.log(`Transcode to MP4:  node transcode.js`);
  } else {
    console.warn('No video found in', REC_DIR);
  }
})().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
