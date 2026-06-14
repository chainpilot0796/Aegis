const Epoch = require('../models/Epoch');
const { EPOCH_DURATION } = require('../config/constants');

async function checkEpoch() {
  try {
    const currentEpoch = await Epoch.findOne({ status: 'active' });

    if (!currentEpoch) {
      // Create first epoch
      await createEpoch(1);
      return;
    }

    if (Date.now() >= currentEpoch.endTime.getTime()) {
      await advanceEpoch(currentEpoch);
    }
  } catch (error) {
    console.error('[EpochEngine] Error checking epoch:', error.message);
  }
}

async function advanceEpoch(currentEpoch) {
  // Complete current epoch
  currentEpoch.status = 'completed';
  await currentEpoch.save();

  const nextNumber = currentEpoch.epochNumber + 1;
  await createEpoch(nextNumber);

  console.log(`[EpochEngine] Advanced to epoch ${nextNumber}`);
}

async function createEpoch(epochNumber) {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + EPOCH_DURATION);

  await Epoch.create({
    epochNumber,
    startTime,
    endTime,
  });

  console.log(`[EpochEngine] Created epoch ${epochNumber}`);
}

module.exports = { checkEpoch, advanceEpoch };
