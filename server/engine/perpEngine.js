const Position = require('../models/Position');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Vault = require('../models/Vault');
const priceEngine = require('./priceEngine');
const feeEngine = require('./feeEngine');
const bitgoService = require('../services/bitgoService');
const { husdcContract } = require('../config/blockchain');
const { MAX_LEVERAGE, MIN_MARGIN, LIQUIDATION_THRESHOLD } = require('../config/constants');

async function openPosition({ user, marketId, direction, margin, leverage, takeProfitPrice, stopLossPrice }) {
  // Normalize direction to uppercase
  direction = (direction || '').toUpperCase();

  // Validate
  if (margin < MIN_MARGIN) {
    throw new Error(`Minimum margin is ${MIN_MARGIN} USDC`);
  }
  if (leverage < 1 || leverage > MAX_LEVERAGE) {
    throw new Error(`Leverage must be between 1x and ${MAX_LEVERAGE}x`);
  }
  if (!['LONG', 'SHORT'].includes(direction)) {
    throw new Error('Direction must be LONG or SHORT');
  }

  const priceData = priceEngine.getPrice(marketId);
  if (!priceData || !priceData.price) {
    throw new Error(`No price available for market ${marketId}`);
  }

  const entryPrice = priceData.price;
  const size = margin * leverage;

  // Calculate and apply open fee
  const openFee = feeEngine.calculateOpenFee(size);

  // Check user balance (backed by USDC on-chain)
  let userDoc = await User.findOne({ address: user.toLowerCase() });
  if (!userDoc || userDoc.traderBalance < margin + openFee) {
    // Try to sync from on-chain USDC balance if available.
    if (husdcContract && user) {
      try {
        const rawBal = await husdcContract.balanceOf(user.toLowerCase());
        const onchainBalance = Number(rawBal) / 1e6; // USDC has 6 decimals
        userDoc = await User.findOneAndUpdate(
          { address: user.toLowerCase() },
          {
            $set: {
              traderBalance: onchainBalance,
              lastActiveAt: new Date(),
            },
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err) {
        console.warn('[PerpEngine] Could not sync USDC balance from chain:', err.message);
      }
    }
  }

  if (!userDoc || userDoc.traderBalance < margin + openFee) {
    throw new Error('Insufficient balance');
  }

  // Deduct margin + fee from user
  await User.findOneAndUpdate(
    { address: user.toLowerCase() },
    {
      $inc: { traderBalance: -(margin + openFee), tradeCount: 1 },
      $set: { lastActiveAt: new Date() },
    }
  );

  // Create position
  const position = await Position.create({
    user: user.toLowerCase(),
    marketId,
    direction,
    margin,
    leverage,
    size,
    entryPrice,
    currentPrice: entryPrice,
    unrealizedPnl: 0,
    takeProfitPrice: takeProfitPrice || null,
    stopLossPrice: stopLossPrice || null,
  });

  // Log transaction
  const tx = await Transaction.create({
    user: user.toLowerCase(),
    type: 'trade_open',
    amount: margin,
    details: { positionId: position._id, marketId, direction, leverage, entryPrice, fee: openFee },
  });

  // Track open fee in vault
  if (openFee > 0) {
    await Vault.findOneAndUpdate({}, { $inc: { totalFeesCollected: openFee } }, { upsert: true });
  }

  // Audit log (fire-and-forget, never blocks)
  bitgoService.logTx('trade_open', { user: user.toLowerCase(), marketId, direction, leverage, margin, entryPrice });

  // Attach tx ref for receipts (e.g. WhatsApp reply)
  position.transactionId = tx._id.toString();
  return position;
}

async function closePosition(positionId) {
  const position = await Position.findById(positionId);
  if (!position) throw new Error('Position not found');
  if (position.status !== 'open') throw new Error('Position is not open');

  const priceData = priceEngine.getPrice(position.marketId);
  const currentPrice = priceData ? priceData.price : position.currentPrice;

  const { unrealizedPnl } = calculatePnl(position, currentPrice);

  // Calculate fees
  const hoursOpen = (Date.now() - position.openedAt.getTime()) / (1000 * 60 * 60);
  const borrowFee = feeEngine.calculateBorrowFee(position.size, hoursOpen);
  const closeFee = feeEngine.calculateCloseFee(position.size);
  const totalFees = borrowFee + closeFee;

  const realizedPnl = unrealizedPnl - totalFees;

  // Update position
  position.status = 'closed';
  position.closedAt = new Date();
  position.closePrice = currentPrice;
  position.currentPrice = currentPrice;
  position.unrealizedPnl = 0;
  position.realizedPnl = realizedPnl;
  position.borrowFees = borrowFee;
  await position.save();

  // Credit user: margin + realized PnL
  const credit = position.margin + realizedPnl;
  await User.findOneAndUpdate(
    { address: position.user },
    {
      $inc: { traderBalance: credit, totalPnl: realizedPnl },
      $set: { lastActiveAt: new Date() },
    }
  );

  // Log transaction
  await Transaction.create({
    user: position.user,
    type: 'trade_close',
    amount: Math.abs(realizedPnl),
    details: {
      positionId: position._id,
      closePrice: currentPrice,
      realizedPnl,
      fees: totalFees,
    },
  });

  // Track fees in vault
  if (totalFees > 0) {
    await Vault.findOneAndUpdate({}, { $inc: { totalFeesCollected: totalFees } }, { upsert: true });
  }

  bitgoService.logTx('trade_close', { user: position.user, closePrice: currentPrice, realizedPnl, fees: totalFees });

  return position;
}

async function checkPositions() {
  try {
    const openPositions = await Position.find({ status: 'open' });

    for (const position of openPositions) {
      const priceData = priceEngine.getPrice(position.marketId);
      if (!priceData || !priceData.price) continue;

      const currentPrice = priceData.price;
      const { unrealizedPnl } = calculatePnl(position, currentPrice);

      // Update current price and PnL
      position.currentPrice = currentPrice;
      position.unrealizedPnl = unrealizedPnl;

      // Check take profit
      if (position.takeProfitPrice) {
        if (
          (position.direction === 'LONG' && currentPrice >= position.takeProfitPrice) ||
          (position.direction === 'SHORT' && currentPrice <= position.takeProfitPrice)
        ) {
          await closePosition(position._id);
          continue;
        }
      }

      // Check stop loss
      if (position.stopLossPrice) {
        if (
          (position.direction === 'LONG' && currentPrice <= position.stopLossPrice) ||
          (position.direction === 'SHORT' && currentPrice >= position.stopLossPrice)
        ) {
          await closePosition(position._id);
          continue;
        }
      }

      // Check liquidation: if loss exceeds threshold * margin
      if (unrealizedPnl < 0 && Math.abs(unrealizedPnl) >= position.margin * LIQUIDATION_THRESHOLD) {
        // Liquidate
        const liquidationFee = feeEngine.calculateLiquidationFee(position.margin);
        position.status = 'liquidated';
        position.closedAt = new Date();
        position.closePrice = currentPrice;
        position.realizedPnl = -(position.margin - liquidationFee);
        position.unrealizedPnl = 0;
        await position.save();

        await User.findOneAndUpdate(
          { address: position.user },
          {
            $inc: { totalPnl: -(position.margin) },
            $set: { lastActiveAt: new Date() },
          }
        );
        bitgoService.logTx('liquidation', { user: position.user, marketId: position.marketId, margin: position.margin, currentPrice });
        continue;
      }

      await position.save();
    }
  } catch (error) {
    console.error('[PerpEngine] Error checking positions:', error.message);
  }
}

async function getOpenPositions(user) {
  return Position.find({ user: user.toLowerCase(), status: 'open' }).sort({ openedAt: -1 }).lean();
}

async function getPositionHistory(user) {
  return Position.find({
    user: user.toLowerCase(),
    status: { $in: ['closed', 'liquidated'] },
  })
    .sort({ closedAt: -1 })
    .lean();
}

function calculatePnl(position, currentPrice) {
  const priceDiff = currentPrice - position.entryPrice;
  const direction = position.direction === 'LONG' ? 1 : -1;
  const unrealizedPnl = (priceDiff / position.entryPrice) * position.size * direction;
  const roe = position.margin > 0 ? (unrealizedPnl / position.margin) * 100 : 0;
  return { unrealizedPnl, roe };
}

module.exports = {
  openPosition,
  closePosition,
  checkPositions,
  getOpenPositions,
  getPositionHistory,
  calculatePnl,
};
