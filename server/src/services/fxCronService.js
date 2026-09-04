const cron = require('node-cron');
const { getExchangeRates } = require('./currencyService');
const liquidityManager = require('./liquidityManager');
const SUPPORTED_CURRENCIES = require('../config/currencies');

class FXCronService {
  constructor() {
    this.isRunning = false;
    this.lastTickTime = null;
    this.rateHistory = new Map(); // Store rolling 24h rates for SMA/EMA
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[FXCronService] Background FX Rate Ingestion & Volatility Pipeline started (Interval: Every 60s)');

    // Run initial sync immediately
    this.syncRatesAndLiquidity();

    // Schedule cron every minute
    cron.schedule('*/1 * * * *', async () => {
      await this.syncRatesAndLiquidity();
      await this.processScheduledTransactions();
    });
  }

  async processScheduledTransactions() {
    try {
      const Transaction = require('../models/Transaction');
      const settlementEngine = require('./settlementEngine');

      if (!Transaction.find) return;

      const dueTransactions = await Transaction.find({
        status: 'SCHEDULED',
        scheduledFor: { $lte: new Date() }
      });

      if (dueTransactions.length > 0) {
        console.log(`[FXCronService] Found ${dueTransactions.length} scheduled transactions due for execution.`);
        for (const tx of dueTransactions) {
          console.log(`[FXCronService] Executing scheduled transaction ${tx._id} (Scheduled for: ${tx.scheduledFor})`);
          await settlementEngine.processSettlement(tx);
        }
      }
    } catch (err) {
      console.warn('[FXCronService] Error processing scheduled transactions:', err.message);
    }
  }

  async syncRatesAndLiquidity() {
    try {
      const baseCurrencies = ['USD', 'EUR', 'GBP'];
      for (const base of baseCurrencies) {
        const ratesData = await getExchangeRates(base);
        if (ratesData && ratesData.conversion_rates) {
          this.recordRateTick(base, ratesData.conversion_rates);
        }
      }

      this.lastTickTime = new Date();
    } catch (err) {
      console.warn('[FXCronService] Scheduled rate sync warning:', err.message);
    }
  }

  recordRateTick(base, rates) {
    const timestamp = Date.now();
    for (const [target, rate] of Object.entries(rates)) {
      const pair = `${base}/${target}`;
      if (!this.rateHistory.has(pair)) {
        this.rateHistory.set(pair, []);
      }
      const history = this.rateHistory.get(pair);
      history.push({ timestamp, rate });

      // Keep maximum 1440 entries (24 hours at 1 tick/min)
      if (history.length > 1440) {
        history.shift();
      }
    }
  }

  getMovingAverages(sourceCurrency, destinationCurrency) {
    const pair = `${sourceCurrency.toUpperCase()}/${destinationCurrency.toUpperCase()}`;
    const history = this.rateHistory.get(pair) || [];

    if (history.length === 0) {
      return { sma24h: null, ema12h: null, dataPoints: 0 };
    }

    const rates = history.map(h => h.rate);
    const sum = rates.reduce((a, b) => a + b, 0);
    const sma = sum / rates.length;

    // Calculate EMA
    const k = 2 / (rates.length + 1);
    let ema = rates[0];
    for (let i = 1; i < rates.length; i++) {
      ema = (rates[i] * k) + (ema * (1 - k));
    }

    return {
      sma24h: parseFloat(sma.toFixed(6)),
      ema12h: parseFloat(ema.toFixed(6)),
      dataPoints: rates.length
    };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastTickTime: this.lastTickTime,
      trackedPairsCount: this.rateHistory.size
    };
  }
}

module.exports = new FXCronService();
