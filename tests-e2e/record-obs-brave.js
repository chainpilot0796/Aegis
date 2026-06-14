/**
 * Aegis.0G demo recording v3 — OBS captures the desktop, Playwright drives Brave.
 *
 * Why this works where v1/v2 didn't: OBS records the WHOLE desktop, so any
 * MetaMask popup (which is a separate Chromium window) is captured for free.
 * Playwright doesn't need to detect popup-close at all — it just drives the
 * dApp page in the foreground tab with simple time-based pacing, and the
 * recording faithfully captures both the dApp animation AND your MetaMask
 * clicks side-by-side.
 *
 * Prereqs:
 *   1. OBS Studio 28+ is installed (you already have it). Open OBS once and:
 *        a. Tools -> WebSocket Server Settings -> Enable, port 4455, set a
 *           password. Set OBS_WS_PASSWORD env var to that password before
 *           running this script (or pass via CLI arg).
 *        b. Make sure your scene has a Display Capture source. The default
 *           Scene named "Scene" is fine; or create one named "AegisDemo"
 *           and set OBS_SCENE env var.
 *        c. Settings -> Output -> Recording -> Format mp4, encoder NVENC
 *           H.264 (or x264 fallback), choose an output dir. The script logs
 *           OBS's reported output path at the end so you can find the file.
 *   2. Brave is closed (no profile-locked instances).
 *   3. Your real MetaMask is set up with the 0G Aristotle network, and your
 *      wallet has mainnet 0G + (optional) A-USDC.
 *
 * Usage:
 *   $env:OBS_WS_PASSWORD = "your-password"
 *   node record-obs-brave.js
 *
 * The script:
 *   - Connects to OBS, starts recording.
 *   - Launches Brave with your real profile (Work).
 *   - Drives the dapp through landing -> shield -> connect -> recommend ->
 *     activate -> trade -> leaderboard, pausing 25 seconds at each MetaMask
 *     popup beat so you can click Approve at your own pace.
 *   - Stops OBS, closes Brave, prints the OBS-reported recording path.
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { chromium } = require('playwright');
const OBSWebSocket = require('obs-websocket-js').default;
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });

const CLIENT          = process.env.CLIENT_BASE       || 'http://127.0.0.1:5173';
const OBS_WS_URL      = process.env.OBS_WS_URL        || 'ws://127.0.0.1:4455';
const OBS_WS_PASSWORD = process.env.OBS_WS_PASSWORD   || '';
const OBS_SCENE       = process.env.OBS_SCENE         || null; // if set, switch to it

function findBraveExecutable() {
  if (process.env.BRAVE_EXE && fs.existsSync(process.env.BRAVE_EXE)) return process.env.BRAVE_EXE;
  const candidates = [
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    'C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe',
    path.join(os.homedir(), 'AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}
function findBraveUserDataDir() {
  if (process.env.BRAVE_PROFILE && fs.existsSync(process.env.BRAVE_PROFILE)) return process.env.BRAVE_PROFILE;
  const candidates = [
    path.join(os.homedir(), 'AppData/Local/BraveSoftware/Brave-Browser/User Data'),
    path.join(os.homedir(), 'AppData/Roaming/BraveSoftware/Brave-Browser/User Data'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}
function resolveProfileDir(userDataDir, friendlyName) {
  if (!friendlyName) return null;
  try {
    const ls = JSON.parse(fs.readFileSync(path.join(userDataDir, 'Local State'), 'utf8'));
    const cache = ls?.profile?.info_cache || {};
    const target = friendlyName.toLowerCase();
    for (const [dir, meta] of Object.entries(cache)) {
      const candidates = [meta.name, meta.shortcut_name, meta.gaia_name, meta.user_name];
      if (candidates.some((c) => c && String(c).toLowerCase() === target)) return dir;
    }
  } catch {}
  return null;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothScroll(page, totalMs, dy) {
  const steps = Math.max(1, Math.ceil(totalMs / 16));
  const step = dy / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'auto' }), step).catch(() => {});
    await pause(16);
  }
}

async function banner(page, message, color = '#A78BFA') {
  await page.evaluate(({ message, color }) => {
    let el = document.getElementById('aegis-rec-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aegis-rec-banner';
      el.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: rgba(7,7,12,0.96); color: white;
        border: 2px solid ${color};
        border-radius: 12px; padding: 14px 22px;
        font-family: 'Geist Mono', monospace; font-size: 14px;
        z-index: 2147483647; pointer-events: none;
        box-shadow: 0 8px 30px rgba(167,139,250,0.4);
        max-width: 80vw; text-align: center;
      `;
      document.body.appendChild(el);
    }
    el.style.borderColor = color;
    el.textContent = message;
  }, { message, color }).catch(() => {});
  console.log('>>>', message);
}
async function hideBanner(page) {
  await page.evaluate(() => {
    const el = document.getElementById('aegis-rec-banner');
    if (el) el.remove();
  }).catch(() => {});
}

(async () => {
  console.log('========================================');
  console.log(' Aegis.0G recording — OBS + Brave + real MetaMask');
  console.log('========================================');

  if (!OBS_WS_PASSWORD) {
    console.error('OBS_WS_PASSWORD not set. Open OBS -> Tools -> WebSocket Server Settings,');
    console.error('enable the server, copy the password, then run:');
    console.error('  $env:OBS_WS_PASSWORD = "<password>"; node record-obs-brave.js');
    process.exit(1);
  }

  const exe = findBraveExecutable();
  const profile = findBraveUserDataDir();
  const friendlyName = process.env.BRAVE_PROFILE_NAME || 'Work';
  const profileDir = profile ? resolveProfileDir(profile, friendlyName) : null;

  console.log('Brave exe        :', exe);
  console.log('Brave User Data  :', profile);
  console.log('Profile          :', friendlyName, '->', profileDir || '(default)');
  console.log('OBS WebSocket    :', OBS_WS_URL);
  console.log('');
  if (!exe || !profile) {
    console.error('Brave not found.');
    process.exit(1);
  }

  // ─── 1. Connect OBS WebSocket ──────────────────────────────────────
  const obs = new OBSWebSocket();
  try {
    const { obsWebSocketVersion } = await obs.connect(OBS_WS_URL, OBS_WS_PASSWORD);
    console.log('OBS WebSocket connected; obsWebSocketVersion =', obsWebSocketVersion);
  } catch (err) {
    console.error('OBS connect failed:', err?.message || err);
    console.error('Is OBS running? Is WebSocket Server enabled (port 4455)? Password correct?');
    process.exit(1);
  }

  // Optionally switch scene
  if (OBS_SCENE) {
    try {
      await obs.call('SetCurrentProgramScene', { sceneName: OBS_SCENE });
      console.log('Switched OBS to scene:', OBS_SCENE);
    } catch (e) {
      console.warn('Could not switch scene; continuing on current:', e?.message);
    }
  }

  // Quick status: is OBS already recording?
  const status = await obs.call('GetRecordStatus').catch(() => ({ outputActive: false }));
  if (status.outputActive) {
    console.log('OBS is already recording; stopping first.');
    await obs.call('StopRecord').catch(() => {});
    await pause(1500);
  }

  console.log('Starting OBS recording...');
  await obs.call('StartRecord');
  await pause(2000); // small buffer so the first second of the dapp is captured

  // ─── 2. Launch Brave with real profile ────────────────────────────
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: exe,
      headless: false,
      viewport: { width: 1366, height: 768 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        ...(profileDir ? [`--profile-directory=${profileDir}`] : []),
      ],
      // No recordVideo — OBS handles capture.
      ignoreDefaultArgs: [
        '--enable-automation',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
      ],
    });
  } catch (err) {
    console.error('Brave launch failed:', err.message);
    console.error('Make sure every Brave window is closed (taskbar tray included).');
    await obs.call('StopRecord').catch(() => {});
    await obs.disconnect();
    process.exit(1);
  }

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  for (const p of context.pages()) if (p !== page) await p.close().catch(() => {});

  try {
    // ─── 3. The flow ───────────────────────────────────────────────
    // Beat 1: Landing scroll
    console.log('Beat 1: Landing scroll');
    await page.goto(CLIENT + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await pause(3500);
    await smoothScroll(page, 5500, 1800);
    await pause(1500);
    await smoothScroll(page, 4500, 2200);
    await pause(1500);

    // Beat 2: Connect wallet (real MetaMask popup)
    console.log('Beat 2: Connect wallet');
    await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pause(3000);

    for (const sel of [
      'button:has-text("Connect Wallet")',
      'button:has-text("CONNECT WALLET")',
      'button:has-text("Connect")',
    ]) {
      const el = page.locator(sel).first();
      if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
    }
    await pause(1500);

    await banner(page, '👉 Pick MetaMask in the modal, then click Connect in the popup. ~20s.', '#00E5D4');
    // RainbowKit modal opens; pick MetaMask
    for (const sel of [
      'button:has-text("MetaMask")',
      '[data-testid*="rk-wallet-option"]:has-text("MetaMask")',
    ]) {
      const el = page.locator(sel).first();
      if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
    }
    // Generous fixed wait so you have time to click. OBS captures everything regardless.
    await pause(25_000);
    await hideBanner(page);
    await pause(1500);

    // Beat 3: Recommendation
    console.log('Beat 3: Recommendation');
    await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pause(3000);

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
          await pause(12_000); // AI roundtrip
        }
      } catch (e) {
        console.warn('Recommendation step:', e.message);
      }
    }
    await pause(1500);
    await smoothScroll(page, 1500, 500);

    // Type deposit amount
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.count()) {
      try {
        await amountInput.click({ timeout: 2000 });
        await page.keyboard.type('25', { delay: 30 });
      } catch {}
    }
    await pause(1500);

    // Beat 4: Activate. Up to 3 real MetaMask popups.
    console.log('Beat 4: Activate shield');
    await smoothScroll(page, 1200, 600);
    await pause(800);

    for (const sel of [
      'button:has-text("Show my potential returns")',
      'button:has-text("Show projections")',
      'button:has-text("Show my potential")',
    ]) {
      const el = page.locator(sel).first();
      if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
    }
    await pause(3000);

    for (const sel of [
      'button:has-text("Start earning")',
      'button:has-text("Activate my position")',
      'button:has-text("Activate")',
    ]) {
      const el = page.locator(sel).first();
      if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
    }

    for (const label of [
      'faucet OR approve (popup 1 of up to 3) — ~25s',
      'approve OR createShield (popup 2 of up to 3) — ~25s',
      'createShield (final popup, real on-chain mainnet tx) — ~30s',
    ]) {
      await banner(page, `👉 ${label}`, '#00E5D4');
      await pause(label.includes('final') ? 30_000 : 25_000);
    }
    await hideBanner(page);
    await pause(6000); // success screen render

    // Beat 5: Trade page
    console.log('Beat 5: Trade page agent feed');
    await page.goto(CLIENT + '/app/trade/gold', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pause(5000);
    await smoothScroll(page, 4000, 1200);
    await pause(2500);

    // Beat 6: Leaderboard
    console.log('Beat 6: Leaderboard');
    await page.goto(CLIENT + '/app/leaderboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pause(3500);
  } catch (e) {
    console.warn('Flow error (continuing to stop recording):', e?.message || e);
  }

  // ─── 4. Stop recording, find file ──────────────────────────────────
  console.log('Stopping OBS recording...');
  let stopResult = null;
  try {
    stopResult = await obs.call('StopRecord'); // returns { outputPath: '...' }
  } catch (e) {
    console.warn('StopRecord error:', e?.message);
  }
  await pause(1500);
  try { await context.close(); } catch {}
  try { await obs.disconnect(); } catch {}

  console.log('');
  console.log('========================================');
  console.log(' Done');
  console.log('========================================');
  if (stopResult?.outputPath) {
    console.log('OBS recording saved to:');
    console.log('   ', stopResult.outputPath);
    console.log('   (already .mp4 if OBS Output > Format = mp4)');
  } else {
    console.log('OBS did not return an output path. Check OBS Settings > Output > Recording.');
    console.log('The recording is wherever OBS stores its files (default: ~/Videos).');
  }
})().catch((e) => { console.error('TOP FAIL:', e); process.exit(1); });
