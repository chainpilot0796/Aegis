const { FEES } = require('../config/constants');
const Position = require('../models/Position');

function calculateOpenFee(size) {
  return size * FEES.openFee;
}

function calculateCloseFee(size) {
  return size * FEES.closeFee;
}

function calculateBorrowFee(size, hoursOpen) {
  return size * FEES.borrowRatePerHour * hoursOpen;
}

function calculateLiquidationFee(margin) {
  return margin * FEES.liquidationFee;
}

async function accrueBorrowFees() {
  try {
    const openPositions = await Position.find({ status: 'open' });

    for (const position of openPositions) {
      const hoursOpen = (Date.now() - position.openedAt.getTime()) / (1000 * 60 * 60);
      const totalBorrowFee = calculateBorrowFee(position.size, hoursOpen);
      position.borrowFees = totalBorrowFee;
      await position.save();
    }
  } catch (error) {
    console.error('[FeeEngine] Error accruing borrow fees:', error.message);
  }
}

module.exports = {
  calculateOpenFee,
  calculateCloseFee,
  calculateBorrowFee,
  calculateLiquidationFee,
  accrueBorrowFees,
};
