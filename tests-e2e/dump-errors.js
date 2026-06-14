const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const fails = [];
  page.on('requestfailed', (req) => fails.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`));
  page.on('console', (m) => { if (m.type() === 'error') fails.push(`console: ${m.text().slice(0, 200)}`); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5173/app/shield', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('Failures observed (', fails.length, '):');
  fails.forEach((f) => console.log(' -', f));
  await browser.close();
})();
