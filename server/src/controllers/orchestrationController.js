const orchestrationEngine = require('../services/orchestrationEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const liquidityManager = require('../services/liquidityManager');
const evaluationEngine = require('../services/evaluationEngine');
const railPricingService = require('../services/railPricingService');
const { isCurrencySupported } = require('../config/currencies');
const { getExchangeRates } = require('../services/currencyService');
const portfolioController = require('../controllers/portfolioController');
const transactionController = require('../controllers/transactionController');
const { extractIntent, buildComparisonExplanation, buildRouteAnalysis, buildProviderQuoteResponse } = require('../services/aiAgentService');

// Detect the action type from the user prompt
function detectActionType(prompt) {
  const lower = prompt.toLowerCase();
  
  // Transfer-related actions
  if (/\b(transfer|send|pay|move|schedule|compare|route)\b/.test(lower)) {
    return 'TRANSFER';
  }
  
  // Balance/portfolio actions
  if (/\b(balance|wallet|portfolio|holdings|funds|money)\b/.test(lower)) {
    return 'BALANCE';
  }
  
  // Currency conversion actions
  if (/\b(convert|exchange|rate|rates|currency)\b/.test(lower)) {
    return 'CONVERT';
  }
  
  // Transaction history actions
  if (/\b(history|transactions|past|previous|recent)\b/.test(lower)) {
    return 'HISTORY';
  }
  
  // FX forecast actions
  if (/\b(forecast|outlook|trend|prediction|future)\b/.test(lower)) {
    return 'FX_FORECAST';
  }
  
  // Default to transfer for ambiguous prompts
  return 'TRANSFER';
}

exports.previewRoute = async (req, res, next) => {
  try {
    const {
      sourceCurrency = 'USD',
      destinationCurrency = 'EUR',
      amount = 10000,
      paymentMode = 'SEND_AMOUNT',
      priority = 'BALANCED',
      maxPermittedDelayHours = 24
    } = req.body;
    const result = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: Number(amount),
      paymentMode,
      priority,
      maxPermittedDelayHours: Number(maxPermittedDelayHours)
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getFXForecast = async (req, res, next) => {
  try {
    const { sourceCurrency = 'USD', destinationCurrency = 'INR' } = req.body;
    const forecast = await fxForecastingEngine.predictFXMovements(sourceCurrency, destinationCurrency);
    res.status(200).json({ success: true, data: forecast });
  } catch (err) {
    next(err);
  }
};

exports.getRailsStatus = async (req, res, next) => {
  try {
    const status = await liquidityManager.getAllRailSettings();
    res.status(200).json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
};

exports.getProviderQuotes = async (req, res, next) => {
  try {
    const sourceCurrency = String(req.body.sourceCurrency || '').toUpperCase();
    const destinationCurrency = String(req.body.destinationCurrency || '').toUpperCase();
    const amount = Number(req.body.amount);
    if (!isCurrencySupported(sourceCurrency) || !isCurrencySupported(destinationCurrency)) {
      return res.status(400).json({ success: false, message: 'Unsupported currency pair for provider comparisons.' });
    }
    if (sourceCurrency === destinationCurrency) {
      return res.status(400).json({ success: false, message: 'Choose two different currencies.' });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return res.status(400).json({ success: false, message: 'Enter an amount between 0.01 and 10,000,000.' });
    }

    const comparison = await railPricingService.fetchLiveMarketQuotes(sourceCurrency, destinationCurrency, amount);
    res.status(200).json({
      success: true,
      data: {
        ...comparison,
        sourceCurrency,
        destinationCurrency,
        sendAmount: amount
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.runEvaluation = async (req, res, next) => {
  try {
    const { batchSize = 100 } = req.body;
    const evaluation = await evaluationEngine.runEvaluationBenchmark(Number(batchSize));
    res.status(200).json({ success: true, data: evaluation });
  } catch (err) {
    next(err);
  }
};

exports.aiQuery = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transfer request prompt is required' 
      });
    }

    const actionType = detectActionType(prompt);
    
    // Handle BALANCE action
    if (actionType === 'BALANCE') {
      try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        if (!userId) {
          return res.status(200).json({
            success: true,
            requiresClarification: false,
            actionType: 'BALANCE',
            assistantMessage: 'Please log in to view your wallet balance.',
            data: null
          });
        }
        
        const portfolio = await portfolioController.getOrCreatePortfolio(userId);
        const ratesData = await getExchangeRates('USD');
        const rates = (ratesData && ratesData.conversion_rates) || {};
        
        let totalValueUSD = 0;
        const holdings = portfolio.holdings.map(h => {
          const code = h.currency.toUpperCase();
          const amount = Number(h.amount);
          const rateToUSD = rates[code] || 1.0;
          const valueInUSD = rateToUSD > 0 ? (amount / rateToUSD) : amount;
          totalValueUSD += valueInUSD;
          return { currency: code, amount: amount.toFixed(2), valueUSD: valueInUSD.toFixed(2) };
        });
        
        const balanceText = holdings.map(h => `${h.currency}: ${h.amount}`).join(', ');
        const message = `Your wallet balance: ${balanceText}. Total value: $${totalValueUSD.toFixed(2)} USD.`;
        
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'BALANCE',
          assistantMessage: message,
          data: { holdings, totalValueUSD: totalValueUSD.toFixed(2) }
        });
      } catch (err) {
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'BALANCE',
          assistantMessage: 'Could not fetch wallet balance. Please try again.',
          data: null
        });
      }
    }
    
    // Handle CONVERT action
    if (actionType === 'CONVERT') {
      const amountMatch = prompt.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 100;
      
      // Try to extract currencies
      const currencyCodes = ['USD', 'EUR', 'GBP', 'INR', 'BRL', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
      const foundCurrencies = currencyCodes.filter(c => prompt.toUpperCase().includes(c));
      
      if (foundCurrencies.length >= 2) {
        const base = foundCurrencies[0];
        const target = foundCurrencies[1];
        try {
          const ratesData = await getExchangeRates(base);
          const rates = ratesData.conversion_rates || {};
          const rate = rates[target] || 1;
          const converted = (amount * rate).toFixed(2);
          const message = `${amount} ${base} = ${converted} ${target} (rate: 1 ${base} = ${rate} ${target})`;
          return res.status(200).json({
            success: true,
            requiresClarification: false,
            actionType: 'CONVERT',
            assistantMessage: message,
            data: { base, target, amount, converted, rate }
          });
        } catch (err) {
          return res.status(200).json({
            success: true,
            requiresClarification: false,
            actionType: 'CONVERT',
            assistantMessage: 'Could not fetch exchange rates. Please try again.',
            data: null
          });
        }
      } else {
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'CONVERT',
          assistantMessage: 'Please specify both currencies. For example: "Convert 100 USD to EUR"',
          data: null
        });
      }
    }
    
    // Handle FX_FORECAST action
    if (actionType === 'FX_FORECAST') {
      const currencyCodes = ['USD', 'EUR', 'GBP', 'INR', 'BRL', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
      const foundCurrencies = currencyCodes.filter(c => prompt.toUpperCase().includes(c));
      
      const source = foundCurrencies[0] || 'USD';
      const destination = foundCurrencies[1] || 'INR';
      
      try {
        const forecast = await fxForecastingEngine.predictFXMovements(source, destination);
        const message = `FX Forecast for ${source} → ${destination}: Current rate: ${forecast.currentRate || 'N/A'}, Trend: ${forecast.classification || 'N/A'}, Volatility: ${forecast.volatility || 'N/A'}%`;
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'FX_FORECAST',
          assistantMessage: message,
          data: forecast
        });
      } catch (err) {
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'FX_FORECAST',
          assistantMessage: 'Could not fetch FX forecast. Please try again.',
          data: null
        });
      }
    }
    
    // Handle HISTORY action
    if (actionType === 'HISTORY') {
      try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        if (!userId) {
          return res.status(200).json({
            success: true,
            requiresClarification: false,
            actionType: 'HISTORY',
            assistantMessage: 'Please log in to view your transaction history.',
            data: null
          });
        }
        
        // Fetch transactions directly
        const Transaction = require('../models/Transaction');
        const transactions = await Transaction.find({
          $or: [{ sender: userId }, { recipient: userId }]
        }).sort({ timestamp: -1 }).limit(10).lean();
        
        if (transactions.length === 0) {
          return res.status(200).json({
            success: true,
            requiresClarification: false,
            actionType: 'HISTORY',
            assistantMessage: 'You have no transaction history yet.',
            data: { transactions: [] }
          });
        }
        
        const txSummary = transactions.map((tx, i) => 
          `${i+1}. ${tx.amount} ${tx.sourceCurrency} → ${tx.destinationCurrency} (${tx.status}) - ${new Date(tx.timestamp).toLocaleDateString()}`
        ).join('\n');
        
        const message = `Your recent transactions:
${txSummary}`;
        
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'HISTORY',
          assistantMessage: message,
          data: { transactions }
        });
      } catch (err) {
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'HISTORY',
          assistantMessage: 'Could not fetch transaction history. Please try again.',
          data: null
        });
      }
    }
    
    // Handle TRANSFER action (existing functionality)
    const intentResult = await extractIntent(prompt);
    const parsed = intentResult.parsed;
    
    if (intentResult.requiresClarification) {
      return res.status(200).json({
        success: false,
        requiresClarification: true,
        clarificationMessage: intentResult.clarificationMessage,
        parsed: parsed,
        fallbackReason: intentResult.fallbackReason || 'validation_failed'
      });
    }
    
    // Call existing route evaluation
    const routeResult = await orchestrationEngine.routePayment({
      sourceCurrency: parsed.sourceCurrency,
      destinationCurrency: parsed.destinationCurrency,
      amount: parsed.amount,
      paymentMode: parsed.paymentMode,
      priority: parsed.priority,
      maxPermittedDelayHours: 24
    });
    
    // Call existing provider quotes
    const providerComparison = await railPricingService.fetchLiveMarketQuotes(
      parsed.sourceCurrency,
      parsed.destinationCurrency,
      parsed.amount
    );
    
    // Build route analysis using existing functionality
    const routeAnalysis = buildRouteAnalysis(routeResult, 'Based on route evaluation');
    
    // Build provider quote response
    const providerQuotes = buildProviderQuoteResponse(providerComparison);
    
    // Build explanation
    const explanation = buildComparisonExplanation({
      routeAnalysis: routeResult,
      providerComparison: providerComparison,
      parsed
    });
    
    // Build final response
    const response = {
      success: true,
      requiresClarification: false,
      actionType: 'TRANSFER',
      parsed: {
        amount: parsed.amount,
        sourceCurrency: parsed.sourceCurrency,
        destinationCurrency: parsed.destinationCurrency,
        priority: parsed.priority,
        paymentMode: parsed.paymentMode,
        explanation: parsed.explanation,
        missingFields: parsed.missingFields
      },
      routeAnalysis,
      providerQuotes,
      assistantMessage: explanation.short
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};