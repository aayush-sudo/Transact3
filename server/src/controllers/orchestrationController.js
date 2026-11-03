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

function mapIntentToAction(intent) {
  const intentMap = {
    'TRANSFER_REQUEST': 'TRANSFER',
    'CHEAPEST_TRANSFER': 'TRANSFER',
    'FASTEST_TRANSFER': 'TRANSFER',
    'TRANSFER_COMPARISON': 'TRANSFER',
    'COMPETITOR_COMPARISON': 'COMPETITOR_COMPARISON',
    'CURRENCY_CONVERSION': 'CONVERT',
    'WALLET_BALANCE': 'BALANCE',
    'WALLET_HOLDINGS': 'BALANCE',
    'FX_FORECAST': 'FX_FORECAST',
    'FX_TIMING_ANALYSIS': 'FX_TIMING_ANALYSIS',
    'FX_INFORMATION': 'FX_FORECAST',
    'TRANSACTION_HISTORY': 'HISTORY',
    'TRANSACTION_STATUS': 'HISTORY',
    'RECIPIENT_TRANSFER': 'TRANSFER',
    'RECIPIENT_LOOKUP': 'BALANCE',
    'WHAT_IF_ANALYSIS': 'TRANSFER',
    'PAYMENT_SCHEDULING': 'TRANSFER',
    'GREETING': 'GREETING',
    'GENERAL_PLATFORM_QUESTION': 'GENERAL',
    'TRANSACT3_PLATFORM_QUESTION': 'PLATFORM_INFO',
    'GENERAL_KNOWLEDGE': 'GENERAL_KNOWLEDGE',
    'GENERAL_CONVERSATION': 'GENERAL_CONVERSATION',
    'OUT_OF_SCOPE': 'OUT_OF_SCOPE',
    'UNSUPPORTED_OPERATION': 'OUT_OF_SCOPE',
    'TRANSFER_EXPLANATION': 'GENERAL',
    'CLARIFICATION_RESPONSE': 'CLARIFICATION',
    'UNKNOWN': 'UNKNOWN'
  };
  return intentMap[intent] || 'UNKNOWN';
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
    const { prompt, history } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transfer request prompt is required' 
      });
    }

    const conversationHistory = Array.isArray(history) ? history.slice(-10) : [];

    // Extract intent from prompt with conversation history
    const intentResult = await extractIntent(prompt, { history: conversationHistory });
    const parsed = intentResult.parsed;
    const intent = parsed.intent || 'UNKNOWN';
    
    // Handle CLARIFICATION_RESPONSE - merge with previous context
    let mergedParsed = { ...parsed };
    if (intent === 'CLARIFICATION_RESPONSE' || intentResult.isClarification) {
      // Find the last assistant message with parsed data
      const lastContext = conversationHistory
        .slice()
        .reverse()
        .find(m => m.role === 'assistant' && m.parsed);
      
      if (lastContext && lastContext.parsed) {
        const prev = lastContext.parsed;
        // Merge: keep previous values unless new ones are provided
        if (parsed.amount == null && prev.amount != null) mergedParsed.amount = prev.amount;
        if (!parsed.sourceCurrency && prev.sourceCurrency) mergedParsed.sourceCurrency = prev.sourceCurrency;
        if (!parsed.destinationCurrency && prev.destinationCurrency) mergedParsed.destinationCurrency = prev.destinationCurrency;
        if (parsed.priority === 'BALANCED' && prev.priority && prev.priority !== 'BALANCED') mergedParsed.priority = prev.priority;
        if (parsed.paymentMode === 'SEND_AMOUNT' && prev.paymentMode === 'RECIPIENT_GETS') mergedParsed.paymentMode = prev.paymentMode;
        // Update intent to the previous intent
        if (prev.intent && prev.intent !== 'CLARIFICATION_RESPONSE' && prev.intent !== 'UNKNOWN') {
          mergedParsed.intent = prev.intent;
        }
      }
    }
    
    // Update parsed with merged values
    Object.assign(parsed, mergedParsed);
    
    // Now route based on intent
    let actionType = mapIntentToAction(parsed.intent);
    
    // Override: if prompt contains timing keywords, route to FX_TIMING_ANALYSIS
    if (/now or wait|should i convert|good time|wait for|rate to improve|better rate|should i wait|convert today|exchange today/i.test(prompt.toLowerCase())) {
      actionType = 'FX_TIMING_ANALYSIS';
    }
    
    // Handle GREETING
    if (actionType === 'GREETING') {
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'GREETING',
        assistantMessage: "Hello! I'm your Transact3 AI Transfer Assistant. I can help you with transfers, wallet balance, currency conversion, FX forecasts, transaction history, and provider comparisons. What would you like to do?",
        data: null
      });
    }
    
    // Handle WALLET_BALANCE / WALLET_HOLDINGS
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
        const trend = forecast.trendDirection || 'NEUTRAL';
        const volatility = forecast.volatilityPct != null ? forecast.volatilityPct : null;
        const confidence = forecast.confidencePct != null ? forecast.confidencePct : null;
        const message = `FX Forecast for ${source} → ${destination}:\nCurrent rate: ${forecast.currentRate}\nTrend: ${trend}\nVolatility: ${volatility != null ? volatility + '%' : 'N/A'}\nConfidence: ${confidence != null ? confidence + '%' : 'N/A'}\n6h projection: ${forecast.predictions?.h6}\n24h projection: ${forecast.predictions?.h24}\n48h projection: ${forecast.predictions?.h48}`;
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
    
    // Handle FX_TIMING_ANALYSIS action
    if (actionType === 'FX_TIMING_ANALYSIS' || actionType === 'FX_FORECAST' || (actionType === 'CONVERT' && /now or wait|should I convert|good time|wait for|rate to improve|better rate/i.test(prompt))) {
      const currencyCodes = ['USD', 'EUR', 'GBP', 'INR', 'BRL', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
      const foundCurrencies = currencyCodes.filter(c => prompt.toUpperCase().includes(c));
      
      const source = foundCurrencies[0] || 'USD';
      const destination = foundCurrencies[1] || 'INR';
      const amountMatch = prompt.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 100;
      
      try {
        const forecast = await fxForecastingEngine.predictFXMovements(source, destination);
        const currentRate = forecast.currentRate;
        const trend = forecast.trendDirection || 'NEUTRAL';
        const volatility = forecast.volatilityPct;
        const confidence = forecast.confidencePct;
        
        // Calculate amounts
        const nowAmount = (amount * currentRate).toFixed(2);
        
        // Determine favourable direction
        // For USD->INR: higher rate = more INR (favourable)
        // For INR->USD: lower rate = more USD (favourable, since rate is INR per USD, lower means fewer INR needed per USD)
        const isFavourableUp = source === 'USD' && destination === 'INR';
        
        let trendFavourable = false;
        if (isFavourableUp && trend === 'BULLISH') trendFavourable = true;
        if (!isFavourableUp && trend === 'BEARISH') trendFavourable = true;
        
        // Calculate hypothetical scenarios
        const higherRate = (currentRate * 1.005).toFixed(4);
        const lowerRate = (currentRate * 0.995).toFixed(4);
        const higherAmount = (amount * parseFloat(higherRate)).toFixed(2);
        const lowerAmount = (amount * parseFloat(lowerRate)).toFixed(2);
        
        let message = `FX Timing Analysis for ${amount} ${source} → ${destination}:\n\n`;
        message += `Current rate: 1 ${source} = ${currentRate} ${destination}\n`;
        message += `If you convert now: ${amount} ${source} = ${nowAmount} ${destination}\n\n`;
        message += `Forecast trend: ${trend} (confidence: ${confidence}%)\n`;
        message += `Volatility: ${volatility}%\n\n`;
        
        if (trendFavourable) {
          message += `The forecast suggests the rate may move in your favour. `;
          message += `If the rate reaches ${higherRate}: ${amount} ${source} = ${higherAmount} ${destination} (gain of ${(parseFloat(higherAmount) - parseFloat(nowAmount)).toFixed(2)} ${destination}).\n`;
        } else {
          message += `The forecast suggests the rate may move against you. `;
          message += `If the rate drops to ${lowerRate}: ${amount} ${source} = ${lowerAmount} ${destination} (loss of ${(parseFloat(nowAmount) - parseFloat(lowerAmount)).toFixed(2)} ${destination}).\n`;
        }
        
        message += `\nHowever, forecasts are uncertain. `;
        if (volatility != null && volatility > 1) {
          message += `With ${volatility}% volatility, the rate could move significantly in either direction. `;
        }
        message += `If you need the money urgently, converting now removes timing risk. If you're flexible, you could potentially benefit from waiting, but there's no guarantee.`;
        
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'FX_TIMING_ANALYSIS',
          assistantMessage: message,
          data: {
            source, destination, amount,
            currentRate, trend, volatility, confidence,
            nowAmount, higherRate, higherAmount, lowerRate, lowerAmount,
            trendFavourable
          }
        });
      } catch (err) {
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'FX_TIMING_ANALYSIS',
          assistantMessage: 'Could not fetch FX forecast for timing analysis. Please try again.',
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
        
        const txSummary = transactions.map((tx, i) => {
          const amount = tx.sourceAmount != null ? tx.sourceAmount : 'N/A';
          const destAmount = tx.destinationAmount != null ? tx.destinationAmount : null;
          const destInfo = destAmount ? ` (recipient gets ${destAmount} ${tx.destinationCurrency})` : '';
          return `${i+1}. ${amount} ${tx.sourceCurrency} → ${tx.destinationCurrency}${destInfo} (${tx.status}) - ${new Date(tx.timestamp).toLocaleDateString()}`;
        }).join('\n');
        
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
    
    // Handle COMPETITOR_COMPARISON action
    if (actionType === 'COMPETITOR_COMPARISON') {
      try {
        const amount = parsed.amount || 500;
        const sourceCurrency = parsed.sourceCurrency || 'USD';
        const destinationCurrency = parsed.destinationCurrency || 'INR';
        
        // Get provider quotes using existing service
        const providerComparison = await railPricingService.fetchLiveMarketQuotes(
          sourceCurrency,
          destinationCurrency,
          amount
        );
        
        const providerQuotes = buildProviderQuoteResponse(providerComparison);
        const quoteCount = providerQuotes.providerQuotes.length;
        
        let message = `I can compare available providers for ${amount} ${sourceCurrency} to ${destinationCurrency}. `;
        if (quoteCount > 0) {
          const providerNames = providerQuotes.providerQuotes.map(p => p.name).join(', ');
          message += `The comparison feed returned ${quoteCount} provider snapshot(s): ${providerNames}. `;
          message += 'These are provider-reported, non-binding estimates. ';
        } else {
          message += 'No provider comparison snapshots were available for this corridor. ';
        }
        message += 'Transact3 uses its own routing engine (Regional Instant, Card Push, SWIFT Batch) for transfers. Would you like to see the Transact3 route options as well?';
        
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'COMPETITOR_COMPARISON',
          assistantMessage: message,
          data: {
            providerQuotes: providerQuotes.providerQuotes,
            providerQuoteMeta: providerQuotes.providerQuoteMeta,
            sourceCurrency,
            destinationCurrency,
            amount
          }
        });
      } catch (err) {
        return res.status(200).json({
          success: true,
          requiresClarification: false,
          actionType: 'COMPETITOR_COMPARISON',
          assistantMessage: 'I can compare providers like Western Union and Transact3 based on available fees, exchange rates, recipient amounts, and delivery estimates. Would you like a numerical comparison for a specific transfer amount and currency pair?',
          data: null
        });
      }
    }
    
    // Handle GENERAL action
    if (actionType === 'GENERAL') {
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'GENERAL',
        assistantMessage: parsed.explanation || 'I can help you with transfers, wallet balance, currency conversion, FX forecasts, and provider comparisons. What would you like to know?',
        data: null
      });
    }
    
    // Handle UNKNOWN action
    if (actionType === 'UNKNOWN') {
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'UNKNOWN',
        assistantMessage: "I'm not sure I understood that. I can help you with: sending money, checking wallet balance, converting currency, FX forecasts, transaction history, and comparing providers. Could you rephrase your request?",
        data: null
      });
    }
    
    // Handle GENERAL_KNOWLEDGE - answer using LLM without financial APIs
    if (actionType === 'GENERAL_KNOWLEDGE') {
      const apiKey = process.env.GROQ_API_KEY;
      let answer = parsed.explanation || 'I can help with that.';
      
      if (apiKey) {
        try {
          const { callGroq, parseGroqJson } = require('../services/aiAgentService');
          const response = await callGroq({
            prompt: `Answer this question concisely and accurately: ${prompt}`,
            history: [],
            apiKey,
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
          });
          const content = response?.choices?.[0]?.message?.content;
          if (content) answer = content.trim();
        } catch (err) {
          // Fall back to parsed explanation
        }
      }
      
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'GENERAL_KNOWLEDGE',
        assistantMessage: answer,
        data: null
      });
    }
    
    // Handle GENERAL_CONVERSATION
    if (actionType === 'GENERAL_CONVERSATION') {
      const lower = prompt.toLowerCase().trim();
      let answer = '';
      if (/joke|funny/.test(lower)) {
        answer = "Why did the scarecrow win an award? Because he was outstanding in his field! 😄 I'm your Transact3 AI Assistant - I can help with cross-border transfers, currency conversions, FX forecasts, and more. What would you like to do?";
      } else {
        answer = "Hello! I'm your Transact3 AI Assistant. I can help you with cross-border money transfers, currency conversions, FX forecasts, provider comparisons, wallet balance checks, and transaction history. How can I assist you today?";
      }
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'GENERAL_CONVERSATION',
        assistantMessage: answer,
        data: null
      });
    }
    
    // Handle TRANSACT3_PLATFORM_QUESTION
    if (actionType === 'PLATFORM_INFO') {
      const answer = parsed.explanation || `Transact3 is a cross-border money transfer platform that helps you compare transfer routes, exchange rates, and providers. You can send money internationally, check your wallet balance, view FX forecasts, and compare providers like Western Union and Citibank Singapore. I'm here to help you with all of these features. What would you like to know more about?`;
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'PLATFORM_INFO',
        assistantMessage: answer,
        data: null
      });
    }
    
    // Handle OUT_OF_SCOPE
    if (actionType === 'OUT_OF_SCOPE') {
      return res.status(200).json({
        success: true,
        requiresClarification: false,
        actionType: 'OUT_OF_SCOPE',
        assistantMessage: "I'm your Transact3 AI Assistant, designed to help with cross-border transfers, currency conversions, FX forecasts, provider comparisons, and wallet-related questions. I can also help with general questions, but I may not have access to live information or specialised services for every topic. Is there anything related to your transfers I can help with?",
        data: null
      });
    }
    
    // Handle TRANSFER action (existing functionality)
    // parsed and intent already extracted above
    
    // Check for missing fields
    if (parsed.missingFields && parsed.missingFields.length > 0) {
      const missing = parsed.missingFields;
      let clarificationMsg = '';
      if (missing.length === 1) {
        if (missing[0] === 'amount') {
          clarificationMsg = parsed.paymentMode === 'RECIPIENT_GETS'
            ? 'How much should your recipient receive?'
            : 'How much would you like to send?';
        } else if (missing[0] === 'sourceCurrency') {
          clarificationMsg = 'Which currency would you like to send from?';
        } else if (missing[0] === 'destinationCurrency') {
          clarificationMsg = 'Which currency would you like the recipient to receive?';
        }
      } else {
        clarificationMsg = 'I can help you with this transfer. ' + 
          (missing.includes('amount') ? 'How much would you like to send? ' : '') +
          (missing.includes('sourceCurrency') ? 'Which currency are you sending from? ' : '') +
          (missing.includes('destinationCurrency') ? 'Which currency should the recipient receive?' : '');
      }
      
      return res.status(200).json({
        success: false,
        requiresClarification: true,
        clarificationMessage: clarificationMsg.trim() || 'Please provide the missing transfer details.',
        parsed: parsed,
        fallbackReason: 'missing_fields'
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