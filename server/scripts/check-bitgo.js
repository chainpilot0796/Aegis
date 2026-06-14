#!/usr/bin/env node
/**
 * Quick script to verify BitGo connectivity and auth.
 * Run from server dir: node scripts/check-bitgo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bitgoService = require('../services/bitgoService');

async function main() {
  console.log('Checking BitGo...');
  console.log('BITGO_ACCESS_TOKEN set:', !!process.env.BITGO_ACCESS_TOKEN);
  if (!process.env.BITGO_ACCESS_TOKEN || process.env.BITGO_ACCESS_TOKEN === 'YOUR_KEY_HERE') {
    console.log('Result: BitGo is NOT configured (no token). Service runs without custody.');
    process.exit(0);
    return;
  }

  const ok = await bitgoService.init();
  if (!ok) {
    console.log('Result: BitGo init FAILED (check token / network).');
    process.exit(1);
  }

  const info = bitgoService.getInfo();
  console.log('Result: BitGo is WORKING.');
  console.log('Info:', JSON.stringify(info, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
