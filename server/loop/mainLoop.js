const Shield = require('../models/Shield');

let priceInterval = null;
let vaultInterval = null;

function start(io, priceEngine, perpEngine, yieldShieldEngine, feeEngine, vaultEngine) {
  // Fast loop: prices + position checks (every 2 seconds)
  priceInterval = setInterval(async () => {
    try {
      // Broadcast prices
      const prices = priceEngine.getAllPrices();
      io.emit('prices', { prices, timestamp: Date.now() });

      // Check positions for TP/SL/liquidation
      await perpEngine.checkPositions();

      // Check shields for settlement
      const expiredShields = await Shield.find({
        status: 'active',
        settleAt: { $lte: new Date() },
      });

      for (const shield of expiredShields) {
        try {
          await yieldShieldEngine.settleShield(shield._id);
          console.log(`[MainLoop] Auto-settled shield ${shield._id}`);
        } catch (err) {
          console.error(`[MainLoop] Error settling shield ${shield._id}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[MainLoop] Error in price loop:', error.message);
    }
  }, 2000);

  // Slow loop: vault stats broadcast (every 20 seconds)
  vaultInterval = setInterval(async () => {
    try {
      const stats = await vaultEngine.getVaultStats();
      io.emit('vaultStats', stats);
    } catch (error) {
      console.error('[MainLoop] Error in vault loop:', error.message);
    }
  }, 20000);

  console.log('[MainLoop] Started');
}

function stop() {
  if (priceInterval) clearInterval(priceInterval);
  if (vaultInterval) clearInterval(vaultInterval);
}

module.exports = { start, stop };
