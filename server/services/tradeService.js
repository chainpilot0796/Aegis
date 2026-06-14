/**
 * Trade Service — Single execution path for trades
 * Used by: POST /api/trade/open, Elsa agent (NLP → WhatsApp)
 * Uses perp engine; balance backed by USDC on Base Sepolia (0x17b9526493820c6eb04988433b9220b06e210a3e)
 */

const perpEngine = require('../engine/perpEngine');

async function openPosition({ address, marketId, direction, margin, leverage, tp, sl }) {
  return perpEngine.openPosition({
    user: address,
    marketId,
    direction,
    margin: Number(margin),
    leverage: Number(leverage),
    takeProfitPrice: tp ? Number(tp) : undefined,
    stopLossPrice: sl ? Number(sl) : undefined,
  });
}

async function closePosition(positionId) {
  return perpEngine.closePosition(positionId);
}

async function getOpenPositions(address, marketId) {
  let positions = await perpEngine.getOpenPositions(address);
  if (marketId) {
    positions = positions.filter((p) => p.marketId === marketId);
  }
  return positions;
}

async function getPositionHistory(address) {
  return perpEngine.getPositionHistory(address);
}

module.exports = {
  openPosition,
  closePosition,
  getOpenPositions,
  getPositionHistory,
};
