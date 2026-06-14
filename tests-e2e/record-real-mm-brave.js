/**
 * Aegis.0G demo recording — using your real Brave browser + your real MetaMask.
 *
 * No bundled extension, no separate profile, no onboarding. Playwright launches
 * Brave with the user's real User Data dir, the existing MetaMask extension
 * (already loaded by Brave) handles every popup, the user clicks Approve, the
 * recording captures everything as a single .webm.
 *
 * Prereqs (one-time, manual):
 *   1. All Brave windows must be CLOSED before running this script. Chromium
 *      locks the profile directory while it's open. If you forget, the script
 *      aborts with a clear error.
 *   2. Inside Brave: set MetaMask as the default Ethereum wallet so it injects
 *      `window.ethereum` instead of Brave Wallet:
 *        brave://settings/web3 -> "Default Ethereum wallet" -> "MetaMask"
 *      (only matters once; Brave remembers).
 *   3. The 0G Aristotle network needs to be in your MetaMask. If not:
 *        Network name : 0G Aristotle
 *        RPC URL      : https://evmrpc.0g.ai
 *        Chain ID     : 16661
 *        Symbol       : 0G
 *        Explorer     : https://chainscan.0g.ai
 *
 * Usage:
 *   node record-real-mm-brave.js          # auto-detect Brave + User Data
 *   BRAVE_EXE=... BRAVE_PROFILE=... node record-real-mm-brave.js
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { chromium } = require('playwright');
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });

const CLIENT = process.env.CLIENT_BASE || 'http://127.0.0.1:5173';
const REC_DIR = path.join(__dirname, 'recordings');
fs.mkdirSync(REC_DIR, { recursive: true });

function findBraveExecutable() {
  if (process.env.BRAVE_EXE && fs.existsSync(process.env.BRAVE_EXE)) {
    return process.env.BRAVE_EXE;
  }
  const candidates = [
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    'C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe',
    path.join(os.homedir(), 'AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findBraveUserDataDir() {
  if (process.env.BRAVE_PROFILE && fs.existsSync(process.env.BRAVE_PROFILE)) {
    return process.env.BRAVE_PROFILE;
  }
  const candidates = [
    path.join(os.homedir(), 'AppData/Local/BraveSoftware/Brave-Browser/User Data'),
    path.join(os.homedir(), 'AppData/Roaming/BraveSoftware/Brave-Browser/User Data'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Resolve a friendly profile name (e.g. "Work") to its on-disk directory
 * ("Default", "Profile 1", "Profile 7"). Chromium stores the mapping in
 * `<UserData>/Local State` under `profile.info_cache.<dir>.name`.
 * Returns null if the friendly name isn't found.
 */
function resolveProfileDir(userDataDir, friendlyName) {
  if (!friendlyName) return null;
  try {
    const ls = JSON.parse(fs.readFileSync(path.join(userDataDir, 'Local State'), 'utf8'));
    const cache = ls?.profile?.info_cache || {};
    const target = friendlyName.toLowerCase();
    for (const [dir, meta] of Object.entries(cache)) {
      const candidates = [meta.name, meta.shortcut_name, meta.gaia_name, meta.user_name];
      if (candidates.some((c) => c && String(c).toLowerCase() === target)) {
        return dir;
      }
    }
  } catch (e) {
    console.warn('Could not read Local State to resolve profile name:', e.message);
  }
  return null;
}

async function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function smoothScroll(page, totalMs, dy) {
  const steps = Math.max(1, Math.ceil(totalMs / 16));
  const step = dy / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'auto' }), step);
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
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(7,7,12,0.96); color: white;
        border: 2px solid ${color};
        border-radius: 12px; padding: 14px 22px;
        font-family: 'Geist Mono', monospace; font-size: 14px;
        z-index: 999999; pointer-events: none;
        box-shadow: 0 8px 30px rgba(167,139,250,0.4);
        max-width: 80vw; text-align: center;
      `;
      document.body.appendChild(el);
    }
    el.style.borderColor = color;
    el.textContent = message;
  }, { message, color }).catch(() => {});
  console.log(`>>> ${message}`);
}

async function hideBanner(page) {
  await page.evaluate(() => {
    const el = document.getElementById('aegis-rec-banner');
    if (el) el.remove();
  }).catch(() => {});
}

async function waitForPageCloseOrTimeout(context, label, timeoutMs = 120_000) {
  console.log(`    [waiting up to ${timeoutMs / 1000}s for ${label}]`);
  const initial = context.pages().length;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (context.pages().length < initial) return true;
    await pause(500);
  }
  return false;
}

(async () => {
  const exe = findBraveExecutable();
  const profile = findBraveUserDataDir();

  // Profile selection. Defaults to "Work" if present, falls back to whatever
  // Default-named profile loads when no arg is passed.
  const friendlyName = process.env.BRAVE_PROFILE_NAME || 'Work';
  const profileDir = profile ? resolveProfileDir(profile, friendlyName) : null;

  console.log('========================================');
  console.log(' Aegis.0G real-MetaMask recording (Brave)');
  console.log('========================================');
  console.log('Brave exe        :', exe || '(not found)');
  console.log('Brave User Data  :', profile || '(not found)');
  console.log('Profile name     :', friendlyName);
  console.log('Profile dir      :', profileDir || '(default — name not found)');
  console.log('Output dir       :', REC_DIR);
  console.log('');

  if (!exe) {
    console.error('Could not auto-detect brave.exe.');
    console.error('Override with: BRAVE_EXE=C:/path/to/brave.exe node record-real-mm-brave.js');
    process.exit(1);
  }
  if (!profile) {
    console.error('Could not auto-detect the Brave User Data dir.');
    console.error('Override with: BRAVE_PROFILE=C:/path/to/User\\ Data node record-real-mm-brave.js');
    process.exit(1);
  }

  console.log('⚠  Make sure ALL Brave windows are CLOSED before continuing.');
  console.log('   The script aborts in 5 seconds if Brave still has the profile locked.');
  console.log('');
  await pause(5000);

  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath:    exe,
      headless:          false,
      channel:           undefined, // we're providing our own executablePath
      viewport:          { width: 1366, height: 768 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        ...(profileDir ? [`--profile-directory=${profileDir}`] : []),
      ],
      recordVideo:       { dir: REC_DIR, size: { width: 1366, height: 768 } },
      // Override Playwright's defaults that suppress extensions. Without this
      // override, `--disable-extensions` strips MetaMask and the dapp sees
      // no window.ethereum at all (page goes blank past the WalletGate).
      ignoreDefaultArgs: [
        '--enable-automation',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
      ],
    });
  } catch (err) {
    console.error('Could not launch Brave. Most common cause: Brave is still running and');
    console.error('has the profile locked. Close every Brave window (taskbar tray included)');
    console.error('and try again.');
    console.error('');
    console.error('Original error:', err.message);
    process.exit(1);
  }

  // Brave opens its own start page on launch. Use the first page if it exists,
  // otherwise create a new one.
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  // Close any extra pages that opened (the Brave start page often shows by default)
  for (const p of context.pages()) {
    if (p !== page) await p.close().catch(() => {});
  }

  // ── Beat 1: Landing scroll ──────────────────────────────────────
  console.log('Beat 1: Landing scroll');
  await page.goto(CLIENT + '/', { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await pause(3000);
  await smoothScroll(page, 5000, 1800);
  await pause(1500);
  await smoothScroll(page, 4500, 2200);
  await pause(1500);

  // ── Beat 2: Connect wallet ──────────────────────────────────────
  console.log('Beat 2: Connect wallet');
  await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(2500);

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

  await banner(page, '👉 Pick MetaMask in the modal, then Approve in the popup', '#00E5D4');
  for (const sel of [
    'button:has-text("MetaMask")',
    '[data-testid*="rk-wallet-option"]:has-text("MetaMask")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 2000 }); break; } catch {}
    }
  }
  await waitForPageCloseOrTimeout(context, 'MetaMask connect popup', 120_000);
  await hideBanner(page);
  await pause(2500);

  // ── Beat 3: Shield page recommendation ──────────────────────────
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
        await pause(10000);
      }
    } catch {}
  }
  await pause(1500);
  await smoothScroll(page, 1500, 500);

  const amountInput = page.locator('input[type="number"]').first();
  if (await amountInput.count()) {
    try {
      await amountInput.click({ timeout: 2000 });
      await page.keyboard.type('25', { delay: 30 });
    } catch {}
  }
  await pause(1500);

  // ── Beat 4: Activate ────────────────────────────────────────────
  console.log('Beat 4: Activate shield');
  await smoothScroll(page, 1500, 700);
  await pause(1000);

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

  // Up to three MetaMask popups in order: faucet (if needed), approve, createShield
  for (const label of [
    'faucet OR approve (1 of up to 3)',
    'approve OR createShield (2 of up to 3)',
    'createShield (final)',
  ]) {
    await banner(page, `👉 Approve in MetaMask — ${label}`, '#00E5D4');
    const closed = await waitForPageCloseOrTimeout(context, label, 150_000);
    if (!closed) {
      console.warn(`  Did not detect a popup close for ${label} within timeout; continuing.`);
    }
    await pause(2500);
  }
  await hideBanner(page);

  // Wait for the success screen
  await pause(8000);
  await smoothScroll(page, 1500, 500);
  await pause(2000);

  // ── Beat 5: Trade page ──────────────────────────────────────────
  console.log('Beat 5: Trade page agent feed');
  await page.goto(CLIENT + '/app/trade/gold', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(4500);
  await smoothScroll(page, 4000, 1200);
  await pause(2500);

  // ── Beat 6: Leaderboard ─────────────────────────────────────────
  console.log('Beat 6: Leaderboard');
  await page.goto(CLIENT + '/app/leaderboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(3500);

  console.log('Closing context, flushing video…');
  await context.close();

  const webms = fs.readdirSync(REC_DIR).filter((f) => f.endsWith('.webm'));
  let best = null, bestBytes = 0;
  for (const f of webms) {
    const p = path.join(REC_DIR, f);
    const b = fs.statSync(p).size;
    if (b > bestBytes) { bestBytes = b; best = p; }
  }
  if (best) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newName = path.join(REC_DIR, `aegis-demo-brave-mm-${stamp}.webm`);
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
