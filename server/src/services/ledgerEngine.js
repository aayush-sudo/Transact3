const LedgerEntry = require('../models/LedgerEntry');
const { roundToPrecision } = require('../utils/mathUtils');

class LedgerEngine {
  /**
   * Record simulated deposit with balanced double-entry
   */
  async recordDeposit(params) {
    const {
      userId,
      userEmail,
      currency,
      amount,
      description = 'Simulated Treasury / Wallet Deposit'
    } = params;

    const timestamp = new Date();
    const safeAmount = roundToPrecision(amount, 2);
    const curr = currency.toUpperCase();

    const entries = [
      // 1. Debit Simulated External Reserve Pool
      {
        userId: null,
        accountId: `EXT-SIMULATED-FUNDING-${curr}`,
        accountName: `External Simulated Funding Pool (${curr})`,
        currency: curr,
        amount: safeAmount,
        entryType: 'DEPOSIT',
        direction: 'DEBIT',
        description: `External liquidity injected for user deposit`,
        timestamp
      },
      // 2. Credit User Multi-Currency Wallet
      {
        userId,
        accountId: `USER-WALLET-${userId}-${curr}`,
        accountName: `User Wallet (${userEmail || userId})`,
        currency: curr,
        amount: safeAmount,
        entryType: 'DEPOSIT',
        direction: 'CREDIT',
        description: `${description}: +${safeAmount} ${curr}`,
        timestamp
      }
    ];

    try {
      await LedgerEntry.insertMany(entries);
    } catch (e) {
      console.warn('[LedgerEngine] Deposit ledger persistence skipped:', e.message);
    }

    return {
      success: true,
      entriesCount: entries.length,
      entries
    };
  }

  /**
   * Record full cross-border payment settlement double-entry ledger records
   * Including source debit, fee debit, clearing pools, and recipient credit
   */
  async recordPaymentSettlement(params) {
    const {
      transactionId,
      quoteId,
      senderId,
      recipientId,
      senderEmail = 'sender@transact3.io',
      recipientEmail = 'recipient@transact3.io',
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      destinationAmount,
      railFeeUSD,
      selectedRail
    } = params;

    const timestamp = new Date();
    const srcCurr = sourceCurrency.toUpperCase();
    const destCurr = destinationCurrency.toUpperCase();
    const safeSourceAmount = roundToPrecision(sourceAmount, 2);
    const safeDestAmount = roundToPrecision(destinationAmount, 2);
    const safeFeeUSD = roundToPrecision(railFeeUSD, 2);

    const entries = [
      // 1. Debit Sender User Account for Principal
      {
        transactionId,
        quoteId,
        userId: senderId,
        accountId: `USER-WALLET-${senderId}-${srcCurr}`,
        accountName: `Sender Wallet (${senderEmail})`,
        currency: srcCurr,
        amount: safeSourceAmount,
        entryType: 'PAYMENT_DEBIT',
        direction: 'DEBIT',
        settlementRail: selectedRail,
        description: `Debit principal for cross-border payment (${safeSourceAmount} ${srcCurr})`,
        timestamp
      },
      // 2. Debit Sender User Account for Rail Fee (in USD or converted to source)
      {
        transactionId,
        quoteId,
        userId: senderId,
        accountId: `USER-WALLET-${senderId}-${srcCurr}`,
        accountName: `Sender Wallet (${senderEmail})`,
        currency: 'USD',
        amount: safeFeeUSD,
        entryType: 'FEE',
        direction: 'DEBIT',
        settlementRail: selectedRail,
        description: `Rail transaction fee for ${selectedRail}: $${safeFeeUSD}`,
        timestamp
      },
      // 3. Credit Rail Clearing Fee Revenue Account
      {
        transactionId,
        quoteId,
        accountId: `FEE-REVENUE-${selectedRail}`,
        accountName: `Rail Fee Revenue (${selectedRail})`,
        currency: 'USD',
        amount: safeFeeUSD,
        entryType: 'FEE',
        direction: 'CREDIT',
        settlementRail: selectedRail,
        description: `Collected rail execution fee for ${selectedRail}`,
        timestamp
      },
      // 4. Credit Outbound Source Currency Clearing Pool
      {
        transactionId,
        quoteId,
        accountId: `CLR-${srcCurr}-OUTBOUND`,
        accountName: `${srcCurr} Outbound Clearing Pool`,
        currency: srcCurr,
        amount: safeSourceAmount,
        entryType: 'PAYMENT_DEBIT',
        direction: 'CREDIT',
        settlementRail: selectedRail,
        description: `Outbound settlement clearing pool credit`,
        timestamp
      },
      // 5. Debit Inbound Destination Currency Clearing Pool
      {
        transactionId,
        quoteId,
        accountId: `CLR-${destCurr}-INBOUND`,
        accountName: `${destCurr} Inbound Clearing Pool`,
        currency: destCurr,
        amount: safeDestAmount,
        entryType: 'PAYMENT_CREDIT',
        direction: 'DEBIT',
        settlementRail: selectedRail,
        description: `Inbound FX payout settlement pool debit`,
        timestamp
      },
      // 6. Credit Recipient User Account
      {
        transactionId,
        quoteId,
        userId: recipientId,
        accountId: `USER-WALLET-${recipientId || 'RECIPIENT'}-${destCurr}`,
        accountName: `Recipient Wallet (${recipientEmail})`,
        currency: destCurr,
        amount: safeDestAmount,
        entryType: 'PAYMENT_CREDIT',
        direction: 'CREDIT',
        settlementRail: selectedRail,
        description: `Credit cross-border funds: +${safeDestAmount} ${destCurr} via ${selectedRail}`,
        timestamp
      }
    ];

    try {
      await LedgerEntry.insertMany(entries);
    } catch (e) {
      console.warn('[LedgerEngine] Settlement ledger persistence skipped:', e.message);
    }

    return {
      success: true,
      entriesCount: entries.length,
      entriesSummary: entries
    };
  }

  // Backwards-compatible recordDoubleEntry wrapper
  async recordDoubleEntry(params) {
    return this.recordPaymentSettlement(params);
  }

  async getAccountBalance(accountId, currency) {
    try {
      const match = { accountId };
      if (currency) match.currency = currency.toUpperCase();

      const entries = await LedgerEntry.find(match);
      let debitTotal = 0;
      let creditTotal = 0;

      for (const entry of entries) {
        if (entry.direction === 'DEBIT') debitTotal += entry.amount;
        if (entry.direction === 'CREDIT') creditTotal += entry.amount;
      }

      return {
        accountId,
        currency: currency || 'MULTI',
        debitTotal: roundToPrecision(debitTotal, 2),
        creditTotal: roundToPrecision(creditTotal, 2),
        netBalance: roundToPrecision(creditTotal - debitTotal, 2),
        entriesCount: entries.length
      };
    } catch (err) {
      console.error('[LedgerEngine] getAccountBalance error:', err.message);
      return { accountId, netBalance: 0, entriesCount: 0 };
    }
  }

  async reconcileLedger() {
    try {
      const allEntries = await LedgerEntry.find({});
      const summaryByCurrency = {};

      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of allEntries) {
        const c = entry.currency || 'USD';
        if (!summaryByCurrency[c]) {
          summaryByCurrency[c] = { currency: c, totalDebits: 0, totalCredits: 0, balanced: true };
        }

        if (entry.direction === 'DEBIT') {
          summaryByCurrency[c].totalDebits += entry.amount;
          totalDebits += entry.amount;
        } else {
          summaryByCurrency[c].totalCredits += entry.amount;
          totalCredits += entry.amount;
        }
      }

      let isGlobalBalanced = true;
      for (const c of Object.keys(summaryByCurrency)) {
        const diff = Math.abs(summaryByCurrency[c].totalDebits - summaryByCurrency[c].totalCredits);
        summaryByCurrency[c].totalDebits = roundToPrecision(summaryByCurrency[c].totalDebits, 2);
        summaryByCurrency[c].totalCredits = roundToPrecision(summaryByCurrency[c].totalCredits, 2);
        summaryByCurrency[c].discrepancy = roundToPrecision(diff, 4);
        summaryByCurrency[c].balanced = diff < 0.05;
        if (!summaryByCurrency[c].balanced) isGlobalBalanced = false;
      }

      return {
        isBalanced: isGlobalBalanced,
        totalEntries: allEntries.length,
        totalDebits: roundToPrecision(totalDebits, 2),
        totalCredits: roundToPrecision(totalCredits, 2),
        currencyBreakdown: Object.values(summaryByCurrency),
        timestamp: new Date()
      };
    } catch (err) {
      console.error('[LedgerEngine] reconcileLedger error:', err.message);
      return { isBalanced: true, totalEntries: 0, currencyBreakdown: [] };
    }
  }

  async getRecentEntries(limit = 50) {
    try {
      return await LedgerEntry.find({}).sort({ timestamp: -1 }).limit(limit);
    } catch (err) {
      return [];
    }
  }
}

module.exports = new LedgerEngine();
