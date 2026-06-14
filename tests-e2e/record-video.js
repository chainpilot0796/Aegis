/**
 * Aegis.0G demo recording.
 *
 * Captures a single ~3-minute .webm of the dapp running on mainnet config,
 * with a minimal EIP-1193 shim that auto-connects the user's wallet so the
 * Trade page actually renders the agent feed with the real shield created
 * by tests-e2e/mainnet-flow.js. Signing methods return placeholder values;
 * we only navigate read-only views in the video, so no signed mutations
 * are attempted.
 *
 * Output: tests-e2e/recordings/aegis-demo-<timestamp>.webm
 *
 * Usage: node record-video.js
 */

const path  = require('path');
const fs    = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'contracts', '.env') });
const { chromium } = require('playwright');

const CLIENT  = process.env.CLIENT_BASE || 'http://127.0.0.1:5173';
const RPC     = process.env.ZG_MAINNET_RPC || 'https://evmrpc.0g.ai';
const ADDRESS = (process.env.AEGIS_DEMO_ADDRESS ||
  '0x4523095f3d872dD51aAB5c6428b513AF645C15B5');
const CHAIN_HEX = '0x4115';   // 16661 = 0G Aristotle mainnet

const OUT_DIR = path.join(__dirname, 'recordings');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function smoothScroll(page, totalMs, targetY) {
  const steps = Math.ceil(totalMs / 16);
  const dy = targetY / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'auto' }), dy);
    await pause(16);
  }
}

async function scrollDown(page, duration = 4000, distance = 1800) {
  await smoothScroll(page, duration, distance);
}

async function scrollToTop(page, duration = 700) {
  const current = await page.evaluate(() => window.scrollY);
  await smoothScroll(page, duration, -current);
}

(async () => {
  console.log('Launching headed-ish chromium with recordVideo...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport:    { width: 1366, height: 768 },
    recordVideo: { dir: OUT_DIR, size: { width: 1366, height: 768 } },
    deviceScaleFactor: 1,
  });

  // Minimal EIP-1193 provider shim. Reads forward to mainnet RPC. Sign + send
  // return placeholder hashes (we never invoke them in this video).
  await context.addInitScript({
    content: `
      (() => {
        const ADDR  = ${JSON.stringify(ADDRESS.toLowerCase())};
        const CHAIN = ${JSON.stringify(CHAIN_HEX)};
        const RPC   = ${JSON.stringify(RPC)};
        const listeners = {};
        async function rpc(method, params = []) {
          const r = await fetch(RPC, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
          });
          const j = await r.json();
          if (j.error) throw new Error(j.error.message);
          return j.result;
        }
        const provider = {
          isMetaMask: true,
          isAegisMock: true,
          chainId: CHAIN,
          selectedAddress: ADDR,
          _state: { accounts: [ADDR], chainId: CHAIN },
          async request({ method, params = [] }) {
            switch (method) {
              case 'eth_accounts':
              case 'eth_requestAccounts':
                return [ADDR];
              case 'eth_chainId':                 return CHAIN;
              case 'net_version':                 return '16661';
              case 'wallet_switchEthereumChain':  return null;
              case 'wallet_addEthereumChain':     return null;
              case 'wallet_requestPermissions':
              case 'wallet_getPermissions':
                return [{ parentCapability: 'eth_accounts', caveats: [], invoker: 'http://aegis-mock' }];
              case 'personal_sign':
                return '0x' + '00'.repeat(65); // placeholder; not used in recorded flow
              case 'eth_signTypedData_v4':
                return '0x' + '00'.repeat(65);
              case 'eth_sendTransaction':
                return '0x' + '00'.repeat(32); // placeholder; not used in recorded flow
              default:
                return rpc(method, params);
            }
          },
          on(event, cb) { (listeners[event] = listeners[event] || []).push(cb); },
          removeListener(event, cb) {
            const arr = listeners[event] || [];
            const i = arr.indexOf(cb);
            if (i >= 0) arr.splice(i, 1);
          },
          enable() { return Promise.resolve([ADDR]); },
        };
        Object.defineProperty(window, 'ethereum', { value: provider, writable: false, configurable: false });
        window.dispatchEvent(new Event('ethereum#initialized'));
      })();
    `,
  });

  const page = await context.newPage();

  // ───── Beat 1: Landing scroll ─────────────────────────────────────
  console.log('Beat 1: landing scroll');
  await page.goto(CLIENT + '/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await pause(2000);                 // hold on the hero
  await scrollDown(page, 5500, 2400); // 5.5s smooth scroll down through hero + stack
  await pause(1500);                 // hold at mid-page
  await scrollDown(page, 4000, 2000); // continue through the Is/Isn't + activity feed
  await pause(1500);
  await scrollToTop(page, 800);
  await pause(800);

  // ───── Beat 2: Launch app → wallet gate → connect ─────────────────
  console.log('Beat 2: launch app + connect');
  await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(2500);

  // Best-effort click on the "Connect" button if one is visible. Multiple
  // possible texts since RainbowKit's label varies.
  const connectSelectors = [
    'button:has-text("Connect Wallet")',
    'button:has-text("Connect")',
    'button:has-text("CONNECT")',
  ];
  for (const sel of connectSelectors) {
    const el = await page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 1500 }); break; } catch {}
    }
  }
  await pause(1500);

  // RainbowKit modal — try the "Browser Wallet" / "MetaMask" / "Injected" entry
  const walletPickerSelectors = [
    'button:has-text("MetaMask")',
    'button:has-text("Browser Wallet")',
    'button:has-text("Injected")',
    '[data-testid*="rk-wallet-option"]',
  ];
  for (const sel of walletPickerSelectors) {
    const el = await page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 1500 }); break; } catch {}
    }
  }
  await pause(2500);

  // ───── Beat 3: Shield page — AI recommendation ────────────────────
  console.log('Beat 3: shield + recommendation');
  await page.goto(CLIENT + '/app/shield', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(2500);
  await scrollDown(page, 2500, 800);
  await pause(1000);

  // Try to type a concern + click "Get recommendation" if reachable
  const concernInput = page.locator('input[placeholder*="worried"], input[placeholder*="inflation"]').first();
  if (await concernInput.count()) {
    try {
      await concernInput.click({ timeout: 1500 });
      await page.keyboard.type("I'm worried about inflation eating my savings.", { delay: 30 });
      await pause(800);
      const btn = page.locator('button:has-text("Get recommendation")').first();
      if (await btn.count()) {
        await btn.click({ timeout: 1500 });
        await pause(10000); // wait for AI roundtrip (NIM ~7s)
      }
    } catch (e) {
      console.warn('recommendation step skipped:', e.message);
    }
  }
  await pause(1500);
  await scrollDown(page, 3000, 1200);
  await pause(1500);

  // ───── Beat 4: Agents key management overview ─────────────────────
  console.log('Beat 4: agents page');
  await page.goto(CLIENT + '/app/agents', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(3000);
  await scrollDown(page, 2500, 700);
  await pause(2000);

  // ───── Beat 5: Trade page — real shield in agent feed ─────────────
  console.log('Beat 5: trade page with live agent feed');
  await page.goto(CLIENT + '/app/trade/gold', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(4000);              // TradingView chart needs a beat to render
  await scrollDown(page, 4500, 1400);
  await pause(2500);              // hold on the agent feed

  // ───── Beat 6: Leaderboard ────────────────────────────────────────
  console.log('Beat 6: leaderboard');
  await page.goto(CLIENT + '/app/leaderboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(3500);

  console.log('Closing context, flushing video...');
  await context.close();
  await browser.close();

  // Move recorded video into a stable filename
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const newName = path.join(OUT_DIR, `aegis-demo-${stamp}.webm`);
  const recorded = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
  let largest = null, largestBytes = 0;
  for (const f of recorded) {
    const p = path.join(OUT_DIR, f);
    const b = fs.statSync(p).size;
    if (b > largestBytes) { largestBytes = b; largest = p; }
  }
  if (largest && largest !== newName) {
    fs.renameSync(largest, newName);
  }
  console.log('Video written:', newName, '(', Math.round(largestBytes / 1024), 'KB )');
})().catch((e) => {
  console.error('Recording failed:', e);
  process.exit(1);
});
