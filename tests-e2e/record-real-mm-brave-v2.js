/**
 * Aegis.0G demo recording v2 — real Brave + real MetaMask.
 *
 * Same goal as v1, but the popup-close detector that hung in v1 is replaced
 * with **element-based detection** on the dapp itself:
 *   - "wallet connected"  =>  the sidebar shows a truncated 0x… address.
 *   - "shield activated"  =>  the success screen renders the three live
 *                              badges (Chain tx / 0G Storage / TEE).
 *
 * Each beat races a real signal against a generous timeout. If the user
 * clicks Approve fast, we advance immediately. If something stalls, we
 * advance anyway after the timeout so the recording can never hang
 * indefinitely. The on-screen banner stays so the user knows what's expected
 * at every beat.
 *
 * Same prereqs as v1:
 *   - All Brave windows closed.
 *   - In Brave: brave://settings/web3 -> default Ethereum wallet = MetaMask.
 *   - In MetaMask: 0G Aristotle added (chain 16661, RPC https://evmrpc.0g.ai,
 *     symbol 0G, explorer https://chainscan.0g.ai), with a funded account.
 *
 * Usage: node record-real-mm-brave-v2.js
 * Env:   BRAVE_PROFILE_NAME (default "Work"), BRAVE_EXE, BRAVE_PROFILE.
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
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
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

/**
 * Wait for any of the given DOM predicates to become true on the page, OR for
 * the timeout to elapse. Resolves either way (no rejection) so the script
 * can never hang forever on a single beat.
 *
 * Each predicate is a string of JS that runs in the page and returns truthy
 * when its signal is detected. Polled every 800ms.
 */
async function waitForAnySignal(page, predicates, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const pred of predicates) {
      try {
        const hit = await page.evaluate(pred);
        if (hit) {
          console.log(`    [${label}] signal hit after ${Math.round((Date.now() - start) / 1000)}s`);
          return true;
        }
      } catch {}
    }
    await pause(800);
  }
  console.log(`    [${label}] no signal in ${Math.round(timeoutMs / 1000)}s; advancing anyway`);
  return false;
}

(async () => {
  const exe = findBraveExecutable();
  const profile = findBraveUserDataDir();
  const friendlyName = process.env.BRAVE_PROFILE_NAME || 'Work';
  const profileDir = profile ? resolveProfileDir(profile, friendlyName) : null;

  console.log('========================================');
  console.log(' Aegis.0G real-MetaMask recording v2');
  console.log('========================================');
  console.log('Brave exe        :', exe);
  console.log('Brave User Data  :', profile);
  console.log('Profile name     :', friendlyName);
  console.log('Profile dir      :', profileDir || '(default)');
  console.log('');
  if (!exe || !profile) {
    console.error('Brave not found. Set BRAVE_EXE / BRAVE_PROFILE.');
    process.exit(1);
  }
  console.log('⚠  Close every Brave window first. Launching in 4 seconds…');
  await pause(4000);

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
      recordVideo: { dir: REC_DIR, size: { width: 1366, height: 768 } },
      ignoreDefaultArgs: [
        '--enable-automation',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
      ],
    });
  } catch (err) {
    console.error('Launch failed:', err.message);
    console.error('Most common cause: Brave still has the profile locked.');
    process.exit(1);
  }

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  for (const p of context.pages()) if (p !== page) await p.close().catch(() => {});

  // ── Beat 1: Landing scroll ────────────────────────────────────────
  console.log('Beat 1: Landing scroll');
  await page.goto(CLIENT + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
  await pause(3000);
  await smoothScroll(page, 5000, 1800);
  await pause(1500);
  await smoothScroll(page, 4500, 2200);
  await pause(1500);

  // ── Beat 2: Connect wallet ────────────────────────────────────────
  console.log('Beat 2: Connect wallet');
  await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(2500);

  // Click in-app "Connect Wallet"
  for (const sel of [
    'button:has-text("Connect Wallet")',
    'button:has-text("CONNECT WALLET")',
    'button:has-text("Connect")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
  }
  await pause(1500);

  // Pick MetaMask in RainbowKit modal
  for (const sel of [
    'button:has-text("MetaMask")',
    '[data-testid*="rk-wallet-option"]:has-text("MetaMask")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
  }

  // Wait for the dapp UI to show a "connected" signal — any of:
  //   - sidebar/topbar shows a 0x… address
  //   - a "CONNECTED" / "DISCONNECT" label appears
  //   - wagmi/RainbowKit injected a connected account
  await banner(page, '👉 Click Connect in MetaMask popup (this banner clears when the dapp sees you)', '#00E5D4');
  await waitForAnySignal(
    page,
    [
      // sidebar truncated address pattern: "0x1234…abcd"
      `!!Array.from(document.querySelectorAll('*')).find(el => /0x[a-fA-F0-9]{4}[\\u2026\\.]{1,3}[a-fA-F0-9]{4}/.test(el.textContent || ''))`,
      // RainbowKit "Disconnect"/"Account" affordances
      `!!document.querySelector('button[aria-label*="account"], button[data-rk*="account"]')`,
      // Any visible truncated address in the sidebar specifically
      `!!Array.from(document.querySelectorAll('aside *')).find(el => /0x[a-fA-F0-9]{4,}/.test(el.textContent || ''))`,
    ],
    180_000,
    'wallet-connected',
  );
  await hideBanner(page);
  await pause(2000);

  // ── Beat 3: Shield page recommendation ────────────────────────────
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
        // Wait until the recommendation card appears
        await waitForAnySignal(
          page,
          [
            `!!document.querySelector('[class*="t-tag-cyan"], [class*="TEE Verified"]') || /TEE/.test(document.body.innerText)`,
            `/Recommended/.test(document.body.innerText) && /\\$/.test(document.body.innerText)`,
          ],
          45_000,
          'recommendation-shown',
        );
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
  await pause(1200);

  // ── Beat 4: Activate ──────────────────────────────────────────────
  console.log('Beat 4: Activate shield');
  await smoothScroll(page, 1200, 600);
  await pause(800);

  // First click "Show my potential returns" (step 1 → step 2)
  for (const sel of [
    'button:has-text("Show my potential returns")',
    'button:has-text("Show projections")',
    'button:has-text("Show my potential")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
  }
  await pause(2000);

  // Then click the real activate button
  for (const sel of [
    'button:has-text("Start earning")',
    'button:has-text("Activate my position")',
    'button:has-text("Activate")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
  }

  // Wait for the success screen — three badges (Chain tx / Storage / TEE).
  // While waiting, keep banners visible so user knows to approve popups.
  await banner(page, '👉 Approve each MetaMask popup (faucet → approve → createShield). The dapp will move on automatically.', '#00E5D4');
  await waitForAnySignal(
    page,
    [
      // Match the success screen header
      `/You'?re all set|Shield activated|Your protected earnings|chainscan\\.0g\\.ai/i.test(document.body.innerText)`,
      // Match presence of the 0G Chain badge or chainscan link
      `!!document.querySelector('a[href*="chainscan.0g.ai/tx"]')`,
      // Match presence of the 0G Storage badge
      `/0G Storage \\u00b7 Agreement Doc|rootHash|Agreement Doc/i.test(document.body.innerText)`,
    ],
    300_000, // 5 minutes — generous for three on-chain confirmations
    'shield-activated',
  );
  await hideBanner(page);
  await pause(4000);
  await smoothScroll(page, 1500, 500);
  await pause(2500);

  // ── Beat 5: Trade page ────────────────────────────────────────────
  console.log('Beat 5: Trade page agent feed');
  await page.goto(CLIENT + '/app/trade/gold', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(5000);
  await smoothScroll(page, 4000, 1200);
  await pause(2500);

  // ── Beat 6: Leaderboard ───────────────────────────────────────────
  console.log('Beat 6: Leaderboard');
  await page.goto(CLIENT + '/app/leaderboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(3500);

  console.log('Closing context, flushing video…');
  await context.close();

  const webms = fs.readdirSync(REC_DIR).filter((f) => f.endsWith('.webm'));
  let best = null, bestBytes = 0;
  for (const f of webms) {
    const p = path.join(REC_DIR, f);
    try {
      const b = fs.statSync(p).size;
      if (b > bestBytes) { bestBytes = b; best = p; }
    } catch {}
  }
  if (best) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newName = path.join(REC_DIR, `aegis-demo-brave-mm-${stamp}.webm`);
    fs.renameSync(best, newName);
    console.log(`Video: ${newName} (${Math.round(bestBytes / 1024)} KB)`);
    console.log(`Transcode to MP4:  node transcode.js`);
  } else {
    console.warn('No video produced.');
  }
})().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
