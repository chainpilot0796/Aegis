/**
 * Aegis.0G demo recording v4 — ffmpeg gdigrab captures the desktop directly,
 * Playwright drives Brave. No OBS, no WebSocket, no extra config.
 *
 * ffmpeg-static is already a devDependency (used for transcoding). We point
 * its bundled binary at `-f gdigrab -i desktop` so it records the entire
 * Windows desktop to an mp4 file. MetaMask popups are separate Chromium
 * windows on the desktop and are captured for free.
 *
 * Playwright only has to drive the dApp page with fixed-time pauses at each
 * popup beat (25-30 seconds per popup so the user can click Approve at their
 * own pace). The script never needs to detect popup-close.
 *
 * Run:
 *   node record-ffmpeg-brave.js
 *
 * Output: tests-e2e/recordings/aegis-demo-ffmpeg-<timestamp>.mp4
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const cp   = require('child_process');
const { chromium } = require('playwright');
const ffmpegPath = require('ffmpeg-static');
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });

const CLIENT = process.env.CLIENT_BASE || 'http://127.0.0.1:5173';
const REC_DIR = path.join(__dirname, 'recordings');
fs.mkdirSync(REC_DIR, { recursive: true });

// Recording params
const FPS         = Number(process.env.REC_FPS    || 24);   // 24 fps is plenty for a demo
const VIDEO_BITRATE = process.env.REC_BITRATE      || '3500k';
const PRESET      = process.env.REC_PRESET         || 'ultrafast'; // CPU vs file size tradeoff
const CRF         = process.env.REC_CRF            || '23';

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
  // Show the banner briefly as a heads-up, then auto-hide so it doesn't
  // pollute the final recording. The console log persists for the operator.
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
        opacity: 1; transition: opacity 600ms ease;
      `;
      document.body.appendChild(el);
    }
    el.style.borderColor = color;
    el.style.opacity = '1';
    el.textContent = message;
    if (el._aegisHideTimer) clearTimeout(el._aegisHideTimer);
    el._aegisHideTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 700);
    }, 3000); // visible 3s, then fade away
  }, { message, color }).catch(() => {});
  console.log('>>>', message);
}
async function hideBanner(page) {
  await page.evaluate(() => {
    const el = document.getElementById('aegis-rec-banner');
    if (el) el.remove();
  }).catch(() => {});
}

function startFfmpegDesktopCapture(outputPath) {
  // Use gdigrab to capture the primary desktop. -draw_mouse 1 captures the
  // cursor so the user's clicks are visible. -f mp4 + faststart for clean
  // playback. -y to overwrite output if it exists.
  const args = [
    '-y',
    '-f',           'gdigrab',
    '-framerate',   String(FPS),
    '-draw_mouse',  '1',
    '-i',           'desktop',
    '-c:v',         'libx264',
    '-preset',      PRESET,
    '-crf',         CRF,
    '-pix_fmt',     'yuv420p',
    '-movflags',    '+faststart',
    outputPath,
  ];
  console.log('Launching ffmpeg:');
  console.log('  ', ffmpegPath, args.join(' '));
  const proc = cp.spawn(ffmpegPath, args, {
    stdio: ['pipe', 'inherit', 'pipe'], // keep stdin pipe open so we can send 'q' to stop
    windowsHide: false,
  });
  let stderrTail = '';
  proc.stderr.on('data', (chunk) => {
    const s = chunk.toString();
    stderrTail = (stderrTail + s).slice(-2000);
  });
  return { proc, getStderrTail: () => stderrTail };
}

function stopFfmpeg(ffmpeg) {
  return new Promise((resolve) => {
    if (!ffmpeg.proc || ffmpeg.proc.killed) return resolve();
    // ffmpeg responds to 'q' on stdin by stopping cleanly and flushing the
    // muxer. Much better than SIGTERM which can corrupt the mp4 header.
    let resolved = false;
    const settle = (reason) => {
      if (resolved) return;
      resolved = true;
      console.log('ffmpeg exited:', reason);
      resolve();
    };
    ffmpeg.proc.once('exit', (code) => settle(`code=${code}`));
    try {
      ffmpeg.proc.stdin.write('q\n');
    } catch (e) {
      console.warn('Could not write q to ffmpeg stdin:', e.message);
    }
    // Hard timeout fallback
    setTimeout(() => {
      if (!resolved) {
        console.warn('ffmpeg did not exit cleanly; sending SIGTERM');
        try { ffmpeg.proc.kill('SIGTERM'); } catch {}
        setTimeout(() => settle('forced'), 2000);
      }
    }, 8000);
  });
}

(async () => {
  const exe = findBraveExecutable();
  const profile = findBraveUserDataDir();
  const friendlyName = process.env.BRAVE_PROFILE_NAME || 'Work';
  const profileDir = profile ? resolveProfileDir(profile, friendlyName) : null;

  console.log('========================================');
  console.log(' Aegis.0G recording — ffmpeg + Brave + real MetaMask');
  console.log('========================================');
  console.log('ffmpeg binary    :', ffmpegPath);
  console.log('Brave exe        :', exe);
  console.log('Brave User Data  :', profile);
  console.log('Profile          :', friendlyName, '->', profileDir || '(default)');
  console.log('Recording params : fps=' + FPS + ' preset=' + PRESET + ' crf=' + CRF);
  console.log('');

  if (!exe || !profile) {
    console.error('Brave not found.');
    process.exit(1);
  }
  if (!fs.existsSync(ffmpegPath)) {
    console.error('ffmpeg binary missing at', ffmpegPath);
    console.error('Run: cd tests-e2e && node node_modules/ffmpeg-static/install.js');
    process.exit(1);
  }

  // Output path is deterministic so the user can find it without grepping logs
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(REC_DIR, `aegis-demo-ffmpeg-${stamp}.mp4`);

  console.log('Output           :', outputPath);
  console.log('');
  console.log('⚠  Close every Brave window first. Launching in 4 seconds…');
  await pause(4000);

  // Start screen capture before Brave so the opening of Brave is part of the take
  const ffmpeg = startFfmpegDesktopCapture(outputPath);
  // Give ffmpeg a moment to initialize the encoder before the dapp opens
  await pause(2500);

  // Launch Brave
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: exe,
      headless: false,
      // Drop the fixed viewport so Brave uses the OS window size; combined
      // with --start-maximized this gives a real full-screen recording. A null
      // viewport tells Playwright "use the browser's actual window size".
      viewport: null,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--start-maximized',
        // The extension toolbar is what anchors MetaMask's compact 360x600
        // popup. Playwright's chromium hides it by default, which is why the
        // user reported MetaMask opening as a full-screen tab. Re-enabling
        // the toolbar restores the normal floating-popup behaviour.
        '--enable-features=ExtensionsToolbarMenu',
        ...(profileDir ? [`--profile-directory=${profileDir}`] : []),
      ],
      // No recordVideo — ffmpeg captures the desktop instead.
      // chromiumSandbox: true is the default; we also strip --no-sandbox from
      // Playwright's defaults because Brave shows a permanent yellow banner
      // ("You are using an unsupported command-line flag: --no-sandbox") that
      // would otherwise be in every recording.
      chromiumSandbox: true,
      ignoreDefaultArgs: [
        '--enable-automation',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--no-sandbox',
      ],
    });
  } catch (err) {
    console.error('Brave launch failed:', err.message);
    console.error('Most common: Brave still has the profile locked. Close every Brave window.');
    await stopFfmpeg(ffmpeg);
    process.exit(1);
  }

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  for (const p of context.pages()) if (p !== page) await p.close().catch(() => {});

  try {
    // Beat 0: navigate to the dapp once and wipe any persistent wagmi /
    // RainbowKit / WalletConnect state in localStorage + sessionStorage +
    // cookies for this origin. Without this, wagmi auto-reconnects from a
    // prior session and the visible "Connect Wallet" flow never fires a
    // MetaMask popup. Belt-and-braces: also clear all cookies on the context.
    console.log('Beat 0: wipe wallet session state for this origin');
    await page.goto(CLIENT + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await pause(1500);
    await page.evaluate(() => {
      try {
        const lsKeys = Object.keys(localStorage);
        for (const k of lsKeys) {
          if (
            /wagmi|rainbowkit|rk[-_]?wallet|walletconnect|wc@/i.test(k) ||
            k.toLowerCase().includes('connector')
          ) {
            localStorage.removeItem(k);
          }
        }
        // sessionStorage clear is cheaper than guessing keys
        sessionStorage.clear();
      } catch {}
    }).catch(() => {});
    await context.clearCookies().catch(() => {});
    // Force a reload so wagmi reinitializes with no persisted connector
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await pause(1500);

    // Beat 1: Landing scroll
    console.log('Beat 1: Landing scroll');
    await pause(2000);
    await smoothScroll(page, 5500, 1800);
    await pause(1500);
    await smoothScroll(page, 4500, 2200);
    await pause(1500);

    // Beat 2: Connect wallet
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

    await banner(page, '👉 Pick MetaMask in the modal, then Connect in the popup. (25s)', '#00E5D4');
    for (const sel of [
      'button:has-text("MetaMask")',
      '[data-testid*="rk-wallet-option"]:has-text("MetaMask")',
    ]) {
      const el = page.locator(sel).first();
      if (await el.count()) { try { await el.click({ timeout: 2000 }); break; } catch {} }
    }
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
          await pause(12_000);
        }
      } catch (e) {
        console.warn('Recommendation step:', e.message);
      }
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

    // Beat 4: Activate
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
      'faucet OR approve (popup 1 of up to 3) — 25s',
      'approve OR createShield (popup 2 of up to 3) — 25s',
      'createShield (final, real on-chain mainnet tx) — 30s',
    ]) {
      await banner(page, `👉 ${label}`, '#00E5D4');
      await pause(label.includes('final') ? 30_000 : 25_000);
    }
    await hideBanner(page);
    await pause(6000);

    // Beat 4b: walk through the on-chain + 0G Storage proofs ----------
    console.log('Beat 4b: open chainscan tx + 0G Storage agreement doc');
    await banner(page, 'Opening the on-chain tx on chainscan.0g.ai…', '#A78BFA');
    // The success panel has three badges. Each is an <a> with target="_blank".
    // We grab their hrefs from the DOM and navigate the current tab to each
    // in turn instead of waiting for new tabs, since new-tab focus + capture
    // is fiddly across windows.
    const proofs = await page.evaluate(() => {
      const out = {};
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const chainEl = anchors.find((a) => /chainscan\.0g\.ai\/tx\//i.test(a.href));
      const docEl = anchors.find((a) => /\/api\/yield-shield\/doc\//i.test(a.href));
      if (chainEl) out.chainUrl = chainEl.href;
      if (docEl) out.docUrl = docEl.href;
      return out;
    }).catch(() => ({}));
    await hideBanner(page);

    if (proofs.chainUrl) {
      console.log('  chainscan tx:', proofs.chainUrl);
      await page.goto(proofs.chainUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      await pause(5500);
      await smoothScroll(page, 4500, 1100);
      await pause(2500);
    } else {
      console.warn('  no chainscan tx link found in DOM');
    }

    if (proofs.docUrl) {
      console.log('  0G Storage agreement doc:', proofs.docUrl);
      await page.goto(proofs.docUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      await pause(4500);
      await smoothScroll(page, 4500, 900);
      await pause(2500);
    } else {
      console.warn('  no 0G Storage doc link found in DOM');
    }

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
    console.warn('Flow error (still flushing recording):', e?.message || e);
  }

  console.log('Stopping ffmpeg cleanly...');
  // Close Brave AFTER stopping recording? No: stop recording first so the
  // tail of the take captures the browser still open. Actually we want the
  // recording to STOP before Brave closes (so the cursor doesn't disappear
  // mid-frame on close). Stop ffmpeg first, then close Brave.
  await stopFfmpeg(ffmpeg);
  try { await context.close(); } catch {}

  console.log('');
  console.log('========================================');
  console.log(' Done');
  console.log('========================================');
  if (fs.existsSync(outputPath)) {
    const bytes = fs.statSync(outputPath).size;
    console.log('Recording saved to:');
    console.log('   ', outputPath);
    console.log('   (' + Math.round(bytes / 1024) + ' KB, plays in Movies & TV / any browser)');
  } else {
    console.error('Output file missing. ffmpeg stderr tail:');
    console.error(ffmpeg.getStderrTail());
  }
})().catch((e) => { console.error('TOP FAIL:', e); process.exit(1); });
