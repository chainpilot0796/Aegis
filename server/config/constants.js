module.exports = {
  FEES: {
    openFee: 0.001,
    closeFee: 0.001,
    borrowRatePerHour: 0.00001,
    liquidationFee: 0.01,
  },
  MAX_LEVERAGE: 50,
  MIN_MARGIN: 1,
  EPOCH_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  LIQUIDATION_THRESHOLD: 0.9,
};
