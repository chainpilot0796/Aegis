const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const body = await page.locator('body').innerText();
  // Print every brand-y substring
  const matches = body.match(/[Aa][eE][gG][iI][sS]|0G|ppn|HEDGE|Hedge|hedge/g) || [];
  console.log('brand matches:', matches.slice(0, 30));
  console.log('first 800 chars of body:');
  console.log(body.slice(0, 800));
  await browser.close();
})();
