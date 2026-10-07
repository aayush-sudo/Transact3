const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const settlementEngine = require('./settlementEngine');

let task;
let processing = false;

async function processDueSettlements() {
  if (processing) return;
  processing = true;
  try {
    for (let count = 0; count < 10; count += 1) {
      const transaction = await Transaction.findOneAndUpdate(
        { status: 'SCHEDULED', scheduledFor: { $lte: new Date() } },
        { status: 'SETTLING' },
        { new: true, sort: { scheduledFor: 1 } }
      );
      if (!transaction) break;
      try {
        await settlementEngine.processSettlement(transaction);
      } catch (error) {
        console.error(`[ScheduledSettlement] Transaction ${transaction._id} failed:`, error.message);
        await settlementEngine.releaseReservations(transaction._id);
      }
    }
  } catch (error) {
    console.error('[ScheduledSettlement] Could not process due settlements:', error.message);
  } finally {
    processing = false;
  }
}

function start() {
  if (task) return;
  task = cron.schedule('* * * * * *', processDueSettlements);
  processDueSettlements();
}

module.exports = { start, processDueSettlements };
