const orchestrationEngine = require('../services/orchestrationEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const liquidityManager = require('../services/liquidityManager');
const evaluationEngine = require('../services/evaluationEngine');
const railPricingService = require('../services/railPricingService');
const { isCurrencySupported } = require('../config/currencies');
const { getExchangeRates } = require('../services/currencyService');
const fxRateEngine = require('../services/fxRateEngine');
const portfolioController = require('../controllers/portfolioController');
const transactionController = require('../controllers/transactionController');
const {
  normalizeCurrency,
  buildComparisonExplanation,
  buildRouteAnalysis,
  buildProviderQuoteResponse
} = require('../services/aiAgentService');
const {
  resolveAgentTurn,
  validateForecastPair,
  describeForecastMismatch
} = require('../services/aiConversationContext');
const currencyConfig = require('../config/currencies');

const debugAi = (...args) => {
  if (process.env.AI_AGENT_DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
    console.log('[AIAgent]', ...args);
  }
};

const formatRateValue = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return String(Number(num.toFixed(6)));
};

const formatNumber = (value, code) => {
  const decimals = String(code).toUpperCase() === 'JPY' ? 0 : 2;
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatSourceAmount = (value, code) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return `N/A ${code}`;
  const decimals = String(code).toUpperCase() === 'JPY' ? 0 : 2;
  const rendered = num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  return `${rendered} ${code}`;
};

const formatCurrencyAmount = (value, code) => {
  const meta = currencyConfig[String(code).toUpperCase()];
  const symbol = meta && meta.symbol && meta.symbol !== code ? meta.symbol : '';
  return symbol ? `${symbol}${formatNumber(value, code)} ${code}` : `${formatNumber(value, code)} ${code}`;
};

const toIsoTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};


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
    const { prompt, history, conversationId: suppliedConversationId } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Transfer request prompt is required'
      });
    }

    const conversationId = typeof suppliedConversationId === 'string' && suppliedConversationId.trim()
      ? suppliedConversationId.trim().slice(0, 120)
      : `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const conversationHistory = Array.isArray(history) ? history.slice(-10) : [];

    // 1-3. Transcript -> active context -> fresh intent -> merged entities.
    //      Newly extracted values always win; unchanged values are retained and
    //      the new intent is never replaced by the previous one.
    const {
      context,
      intentResult,
      parsed,
      resolution,
      actionType: resolvedActionType
    } = await resolveAgentTurn({
      prompt,
      history: conversationHistory,
      conversationId
    });

    const contextVersion = parsed.contextVersion || 0;
    const send = (payload) => res.status(200).json({ conversationId, contextVersion, ...payload });

    debugAi('turn', JSON.stringify({
      conversationId,
      message: prompt.slice(0, 200),
      previousActiveContext: context.active,
      classifiedIntent: intentResult && intentResult.parsed ? intentResult.parsed.intent : null,
      interpretationSource: intentResult && intentResult.interpretationSource,
      interpretationFallbackReason: intentResult && intentResult.fallbackReason ? intentResult.fallbackReason : null,
      extractedEntities: {
        amount: intentResult && intentResult.parsed ? intentResult.parsed.amount : null,
        sourceCurrency: intentResult && intentResult.parsed ? intentResult.parsed.sourceCurrency : null,
        destinationCurrency: intentResult && intentResult.parsed ? intentResult.parsed.destinationCurrency : null
      },
      resolvedContext: {
        intent: parsed.intent,
        amount: parsed.amount,
        sourceCurrency: parsed.sourceCurrency,
        destinationCurrency: parsed.destinationCurrency
      },
      resolution
    }));

    // 4. Ambiguous references must ask, never guess between two live pairs.
    if (context.ambiguousPairs) {
      const options = (context.ambiguousOptions || [])
        .map((pair) => `${pair.sourceCurrency}/${pair.destinationCurrency}`)
        .filter((value, index, all) => all.indexOf(value) === index);
      if (options.length > 1) {
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'CLARIFY',
          clarificationMessage: `Which currency pair do you mean: ${options.join(' or ')}?`,
          parsed,
          resolution
        });
      }
    }

    const actionType = resolvedActionType;

    debugAi('route', JSON.stringify({
      conversationId,
      contextVersion,
      selectedOperation: actionType,
      toolInput: {
        sourceCurrency: parsed.sourceCurrency,
        destinationCurrency: parsed.destinationCurrency,
        amount: parsed.amount
      }
    }));

    // ---------------------------------------------------------------------
    // GREETING
    // ---------------------------------------------------------------------
    if (actionType === 'GREETING') {
      return send({
        success: true,
        requiresClarification: false,
        actionType: 'GREETING',
        assistantMessage: "Hello! I'm your Transact3 AI Transfer Assistant. I can help you with transfers, wallet balance, currency conversion, FX forecasts, transaction history, and provider comparisons. What would you like to do?",
        data: null
      });
    }

    // ---------------------------------------------------------------------
    // WALLET BALANCE
    // ---------------------------------------------------------------------
    if (actionType === 'BALANCE') {
      try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        if (!userId) {
          return send({
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
        const holdings = portfolio.holdings.map((holding) => {
          const code = holding.currency.toUpperCase();
          const amount = Number(holding.amount);
          const rateToUSD = rates[code] || 1.0;
          const valueInUSD = rateToUSD > 0 ? (amount / rateToUSD) : amount;
          totalValueUSD += valueInUSD;
          return { currency: code, amount: amount.toFixed(2), valueUSD: valueInUSD.toFixed(2) };
        });

        const balanceText = holdings.map((holding) => `${holding.currency}: ${holding.amount}`).join(', ');
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'BALANCE',
          assistantMessage: `Your wallet balance: ${balanceText}. Total value: $${totalValueUSD.toFixed(2)} USD.`,
          data: { holdings, totalValueUSD: totalValueUSD.toFixed(2) }
        });
      } catch (err) {
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'BALANCE',
          assistantMessage: 'Could not fetch wallet balance. Please try again.',
          data: null
        });
      }
    }

    // ---------------------------------------------------------------------
    // CURRENCY CONVERSION - display only, never a transfer or payment action
    // ---------------------------------------------------------------------
    if (actionType === 'CONVERT') {
      const source = normalizeCurrency(parsed.sourceCurrency);
      const destination = normalizeCurrency(parsed.destinationCurrency);

      if (!source || !destination) {
        const which = !source && !destination
          ? 'Which currency pair would you like to convert?'
          : (!source
            ? `Which currency would you like to convert into ${destination}?`
            : `Which currency would you like to convert ${source} into?`);
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'CONVERT',
          clarificationMessage: `${which} For example: "How much is 100 USD to INR?"`,
          parsed,
          resolution
        });
      }

      if (source === destination) {
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'CONVERT',
          clarificationMessage: 'Please choose two different currencies to convert between.',
          parsed,
          resolution
        });
      }

      try {
        const rateInfo = await fxRateEngine.getIndicativeConversion(source, destination);
        if (!rateInfo) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'CONVERT',
            assistantMessage: `I couldn't retrieve a ${source}/${destination} exchange rate right now. Please try again in a moment.`,
            data: null
          });
        }

        const timestamp = toIsoTimestamp(rateInfo.timestamp);
        const inverseNote = rateInfo.inverted
          ? ` (derived by inverting the published 1 ${destination} = ${formatRateValue(1 / rateInfo.rate)} ${source} quote)`
          : '';
        const amount = parsed.amount;

        if (amount == null) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'CONVERT',
            parsed,
            assistantMessage: `1 ${source} = ${formatRateValue(rateInfo.rate)} ${destination}${inverseNote}\n\nHow much would you like to convert? Give me an amount and I'll calculate it, for example: "Convert 100 ${source} to ${destination}".\n\nIndicative rate as of ${timestamp}, before any applicable transfer fees or provider spreads.`,
            data: {
              base: source,
              target: destination,
              amount: null,
              converted: null,
              rate: rateInfo.rate,
              inverted: rateInfo.inverted,
              timestamp,
              rateSource: rateInfo.rateSource
            }
          });
        }

        const converted = Number((amount * rateInfo.rate).toFixed(2));
        const message = `${formatSourceAmount(amount, source)} = ${formatCurrencyAmount(converted, destination)}\n\nExchange rate: 1 ${source} = ${formatRateValue(rateInfo.rate)} ${destination}${inverseNote}\n\nIndicative rate as of ${timestamp}. This is an indicative conversion, before any applicable transfer fees or provider spreads.`;

        return send({
          success: true,
          requiresClarification: false,
          actionType: 'CONVERT',
          parsed,
          assistantMessage: message,
          data: {
            base: source,
            target: destination,
            amount,
            converted,
            rate: rateInfo.rate,
            inverted: rateInfo.inverted,
            timestamp,
            rateSource: rateInfo.rateSource
          }
        });
      } catch (err) {
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'CONVERT',
          assistantMessage: 'Could not fetch exchange rates. Please try again.',
          data: null
        });
      }
    }

    // ---------------------------------------------------------------------
    // FX FORECAST - must use the resolved pair and validate the response
    // ---------------------------------------------------------------------
    if (actionType === 'FX_FORECAST') {
      const source = normalizeCurrency(parsed.sourceCurrency);
      const destination = normalizeCurrency(parsed.destinationCurrency);

      if (!source || !destination) {
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'FX_FORECAST',
          clarificationMessage: 'Which currency pair would you like me to forecast? For example: "Forecast USD to INR".',
          parsed,
          resolution
        });
      }

      try {
        const forecast = await fxForecastingEngine.predictFXMovements(source, destination);
        const validation = validateForecastPair(forecast, source, destination);

        debugAi('forecast', JSON.stringify({
          conversationId,
          requestedPair: `${source}/${destination}`,
          returnedPair: forecast && forecast.currencyPair ? forecast.currencyPair : null,
          validated: validation.ok
        }));

        if (!validation.ok) {
          // Never display a forecast that belongs to another pair.
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'FX_FORECAST',
            parsed,
            assistantMessage: describeForecastMismatch(validation),
            data: { rejectedForecast: true, validation }
          });
        }

        const trend = forecast.trendDirection || 'NEUTRAL';
        const volatility = forecast.volatilityPct != null ? forecast.volatilityPct : null;
        const confidence = forecast.confidencePct != null ? forecast.confidencePct : null;
        const amountLine = parsed.amount != null
          ? `\nAt the current rate, ${formatCurrencyAmount(parsed.amount, source)} is about ${formatCurrencyAmount(parsed.amount * forecast.currentRate, destination)}.`
          : '';

        const message = `FX Forecast for ${source} → ${destination}
Current rate: 1 ${source} = ${formatRateValue(forecast.currentRate)} ${destination}
Trend: ${trend}
Volatility: ${volatility != null ? volatility + '%' : 'N/A'}
Confidence: ${confidence != null ? confidence + '%' : 'N/A'}
6h projection: ${formatRateValue(forecast.predictions?.h6)}
12h projection: ${formatRateValue(forecast.predictions?.h12)}
24h projection: ${formatRateValue(forecast.predictions?.h24)}
48h projection: ${formatRateValue(forecast.predictions?.h48)}${amountLine}

Model: Transact3 FX forecasting engine (existing trained pipeline, exponential smoothing on reference rates). Forecasts are uncertain and are not a guarantee of future rates.`;

        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_FORECAST',
          parsed,
          assistantMessage: message,
          data: forecast
        });
      } catch (err) {
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_FORECAST',
          assistantMessage: `Could not fetch an FX forecast for ${source}/${destination}. Please try again.`,
          data: null
        });
      }
    }

    // ---------------------------------------------------------------------
    // FX TIMING ANALYSIS - same pair, real model output
    // ---------------------------------------------------------------------
    if (actionType === 'FX_TIMING_ANALYSIS') {
      const source = normalizeCurrency(parsed.sourceCurrency);
      const destination = normalizeCurrency(parsed.destinationCurrency);

      if (!source || !destination) {
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'FX_TIMING_ANALYSIS',
          clarificationMessage: 'Which currency pair should I analyse for timing? For example: "Should I convert 100 USD to INR now or wait?"',
          parsed,
          resolution
        });
      }

      const amount = parsed.amount != null ? parsed.amount : 1;
      const amountIsAssumed = parsed.amount == null;

      try {
        const forecast = await fxForecastingEngine.predictFXMovements(source, destination);
        const validation = validateForecastPair(forecast, source, destination);
        if (!validation.ok) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'FX_TIMING_ANALYSIS',
            parsed,
            assistantMessage: describeForecastMismatch(validation),
            data: { rejectedForecast: true, validation }
          });
        }

        const currentRate = forecast.currentRate;
        const trend = forecast.trendDirection || 'NEUTRAL';
        const volatility = forecast.volatilityPct;
        const confidence = forecast.confidencePct;

        // The quote is destination-per-source, so a higher projected rate always
        // means more destination currency per unit of source.
        const trendFavourable = trend === 'BULLISH';
        const nowAmount = Number((amount * currentRate).toFixed(2));
        const h24Amount = Number((amount * forecast.predictions.h24).toFixed(2));
        const h48Amount = Number((amount * forecast.predictions.h48).toFixed(2));

        let message = `FX Timing Analysis for ${amountIsAssumed ? `1 ${source}` : formatCurrencyAmount(amount, source)} → ${destination}:\n\n`;
        message += `Current rate: 1 ${source} = ${formatRateValue(currentRate)} ${destination}\n`;
        message += `If you convert now: ${formatCurrencyAmount(nowAmount, destination)}\n\n`;
        message += `Model trend: ${trend} (confidence: ${confidence != null ? confidence + '%' : 'N/A'})\n`;
        message += `Volatility: ${volatility != null ? volatility + '%' : 'N/A'}\n`;
        message += `24h model projection: 1 ${source} = ${formatRateValue(forecast.predictions.h24)} ${destination} → ${formatCurrencyAmount(h24Amount, destination)}\n`;
        message += `48h model projection: 1 ${source} = ${formatRateValue(forecast.predictions.h48)} ${destination} → ${formatCurrencyAmount(h48Amount, destination)}\n\n`;

        if (trendFavourable) {
          message += `The model's projected path is higher, which would give you more ${destination} per ${source} if it holds. `;
          message += `Waiting could yield up to ${formatCurrencyAmount(Math.max(0, h24Amount - nowAmount), destination)} more on this amount over 24h.\n`;
        } else {
          message += `The model's projected path is lower, which would give you fewer ${destination} per ${source} if it holds. `;
          message += `Waiting could cost up to ${formatCurrencyAmount(Math.max(0, nowAmount - Math.min(h24Amount, h48Amount)), destination)} on this amount.\n`;
        }

        message += `\nThese are model projections, not guarantees. `;
        if (volatility != null && volatility > 0.6) {
          message += `With ${volatility}% volatility, the rate could move significantly in either direction. `;
        }
        message += amountIsAssumed
          ? 'Tell me an amount and I can size the scenarios precisely.'
          : 'If you need the money urgently, converting now removes timing risk.';

        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_TIMING_ANALYSIS',
          parsed,
          assistantMessage: message,
          data: {
            source,
            destination,
            amount: parsed.amount,
            amountAssumed: amountIsAssumed,
            currentRate,
            trend,
            volatility,
            confidence,
            nowAmount,
            h24Amount,
            h48Amount,
            trendFavourable,
            predictions: forecast.predictions
          }
        });
      } catch (err) {
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_TIMING_ANALYSIS',
          assistantMessage: `Could not fetch an FX forecast for ${source}/${destination} for timing analysis. Please try again.`,
          data: null
        });
      }
    }

    // ---------------------------------------------------------------------
    // TRANSACTION HISTORY
    // ---------------------------------------------------------------------
    if (actionType === 'HISTORY') {
      try {
        const userId = req.user ? (req.user._id || req.user.id) : null;
        if (!userId) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'HISTORY',
            assistantMessage: 'Please log in to view your transaction history.',
            data: null
          });
        }

        const Transaction = require('../models/Transaction');
        const transactions = await Transaction.find({
          $or: [{ sender: userId }, { recipient: userId }]
        }).sort({ timestamp: -1 }).limit(10).lean();

        if (transactions.length === 0) {
          return send({
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
          return `${i + 1}. ${amount} ${tx.sourceCurrency} → ${tx.destinationCurrency}${destInfo} (${tx.status}) - ${new Date(tx.timestamp).toLocaleDateString()}`;
        }).join('\n');

        return send({
          success: true,
          requiresClarification: false,
          actionType: 'HISTORY',
          assistantMessage: `Your recent transactions:\n${txSummary}`,
          data: { transactions }
        });
      } catch (err) {
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'HISTORY',
          assistantMessage: 'Could not fetch transaction history. Please try again.',
          data: null
        });
      }
    }

    // ---------------------------------------------------------------------
    // COMPETITOR COMPARISON
    // ---------------------------------------------------------------------
    if (actionType === 'COMPETITOR_COMPARISON') {
      const sourceCurrency = normalizeCurrency(parsed.sourceCurrency);
      const destinationCurrency = normalizeCurrency(parsed.destinationCurrency);
      const amount = parsed.amount;

      if (!sourceCurrency || !destinationCurrency) {
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'COMPETITOR_COMPARISON',
          clarificationMessage: 'Which currency pair should I compare providers for? For example: "Compare providers for 100 USD to INR".',
          parsed,
          resolution
        });
      }
      if (amount == null) {
        return send({
          success: false,
          requiresClarification: true,
          actionType: 'COMPETITOR_COMPARISON',
          clarificationMessage: `How much ${sourceCurrency} would you like to compare providers for?`,
          parsed,
          resolution
        });
      }

      try {
        const providerComparison = await railPricingService.fetchLiveMarketQuotes(
          sourceCurrency,
          destinationCurrency,
          amount
        );

        const providerQuotes = buildProviderQuoteResponse(providerComparison);
        const quoteCount = providerQuotes.providerQuotes.length;

        let message = `I can compare available providers for ${formatCurrencyAmount(amount, sourceCurrency)} to ${destinationCurrency}. `;
        if (quoteCount > 0) {
          const providerNames = providerQuotes.providerQuotes.map((provider) => provider.name).join(', ');
          message += `The comparison feed returned ${quoteCount} provider snapshot(s): ${providerNames}. `;
          message += 'These are provider-reported, non-binding estimates. ';
        } else {
          message += 'No provider comparison snapshots were available for this corridor. ';
        }
        message += 'Transact3 uses its own routing engine (Regional Instant, Card Push, SWIFT Batch) for transfers. Would you like to see the Transact3 route options as well?';

        return send({
          success: true,
          requiresClarification: false,
          actionType: 'COMPETITOR_COMPARISON',
          parsed,
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
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'COMPETITOR_COMPARISON',
          assistantMessage: 'I can compare providers like Western Union and Transact3 based on available fees, exchange rates, recipient amounts, and delivery estimates. Would you like a numerical comparison for a specific transfer amount and currency pair?',
          data: null
        });
      }
    }

    // ---------------------------------------------------------------------
    // GENERAL / PLATFORM / CONVERSATION (no financial APIs)
    // ---------------------------------------------------------------------
    if (actionType === 'GENERAL') {
      return send({
        success: true,
        requiresClarification: false,
        actionType: 'GENERAL',
        assistantMessage: parsed.explanation || 'I can help you with transfers, wallet balance, currency conversion, FX forecasts, and provider comparisons. What would you like to know?',
        data: null
      });
    }

    if (actionType === 'UNKNOWN') {
      return send({
        success: true,
        requiresClarification: false,
        actionType: 'UNKNOWN',
        assistantMessage: "I'm not sure I understood that. I can help you with: sending money, checking wallet balance, converting currency, FX forecasts, transaction history, and comparing providers. Could you rephrase your request?",
        data: null
      });
    }

    if (actionType === 'GENERAL_KNOWLEDGE') {
      const apiKey = process.env.GROQ_API_KEY;
      let answer = parsed.explanation || 'I can help with that.';

      if (apiKey) {
        try {
          const { callGroq } = require('../services/aiAgentService');
          const response = await callGroq({
            prompt: `Answer this question concisely and accurately: ${prompt}`,
            history: [],
            apiKey,
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
          });
          const content = response?.choices?.[0]?.message?.content;
          if (content) answer = content.trim();
        } catch (err) {
          // Fall back to the deterministic explanation.
        }
      }

      return send({
        success: true,
        requiresClarification: false,
        actionType: 'GENERAL_KNOWLEDGE',
        assistantMessage: answer,
        data: null
      });
    }

    if (actionType === 'GENERAL_CONVERSATION') {
      const lower = prompt.toLowerCase().trim();
      let answer = '';
      if (/joke|funny/.test(lower)) {
        answer = "Why did the scarecrow win an award? Because he was outstanding in his field! 😄 I'm your Transact3 AI Assistant - I can help with cross-border transfers, currency conversions, FX forecasts, and more. What would you like to do?";
      } else {
        answer = "Hello! I'm your Transact3 AI Assistant. I can help you with cross-border money transfers, currency conversions, FX forecasts, provider comparisons, wallet balance checks, and transaction history. How can I assist you today?";
      }
      return send({
        success: true,
        requiresClarification: false,
        actionType: 'GENERAL_CONVERSATION',
        assistantMessage: answer,
        data: null
      });
    }

    if (actionType === 'PLATFORM_INFO') {
      const answer = parsed.explanation || 'Transact3 is a cross-border money transfer platform that helps you compare transfer routes, exchange rates, and providers. You can send money internationally, check your wallet balance, view FX forecasts, and compare providers like Western Union and Citibank Singapore. I\'m here to help you with all of these features. What would you like to know more about?';
      return send({
        success: true,
        requiresClarification: false,
        actionType: 'PLATFORM_INFO',
        assistantMessage: answer,
        data: null
      });
    }

    if (actionType === 'OUT_OF_SCOPE') {
      return send({
        success: true,
        requiresClarification: false,
        actionType: 'OUT_OF_SCOPE',
        assistantMessage: "I'm your Transact3 AI Assistant, designed to help with cross-border transfers, currency conversions, FX forecasts, provider comparisons, and wallet-related questions. I can also help with general questions, but I may not have access to live information or specialised services for every topic. Is there anything related to your transfers I can help with?",
        data: null
      });
    }

    // ---------------------------------------------------------------------
    // TRANSFER - explicit request only. Never reached by conversion or
    // forecast intents.
    // ---------------------------------------------------------------------
    const requiredFields = ['amount', 'sourceCurrency', 'destinationCurrency'];
    const missing = requiredFields.filter((field) => parsed[field] == null);
    if (missing.length > 0) {
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
        clarificationMsg = 'I can help you with this transfer. '
          + (missing.includes('amount') ? 'How much would you like to send? ' : '')
          + (missing.includes('sourceCurrency') ? 'Which currency are you sending from? ' : '')
          + (missing.includes('destinationCurrency') ? 'Which currency should the recipient receive?' : '');
      }

      return send({
        success: false,
        requiresClarification: true,
        actionType: 'TRANSFER',
        clarificationMessage: clarificationMsg.trim() || 'Please provide the missing transfer details.',
        parsed,
        resolution,
        fallbackReason: 'missing_fields'
      });
    }

    const routeResult = await orchestrationEngine.routePayment({
      sourceCurrency: parsed.sourceCurrency,
      destinationCurrency: parsed.destinationCurrency,
      amount: parsed.amount,
      paymentMode: parsed.paymentMode,
      priority: parsed.priority,
      maxPermittedDelayHours: 24
    });

    const providerComparison = await railPricingService.fetchLiveMarketQuotes(
      parsed.sourceCurrency,
      parsed.destinationCurrency,
      parsed.amount
    );

    const routeAnalysis = buildRouteAnalysis(routeResult, 'Based on route evaluation');
    const providerQuotes = buildProviderQuoteResponse(providerComparison);
    const explanation = buildComparisonExplanation({
      routeAnalysis: routeResult,
      providerComparison,
      parsed
    });

    return send({
      success: true,
      requiresClarification: false,
      actionType: 'TRANSFER',
      parsed: {
        intent: parsed.intent,
        amount: parsed.amount,
        amountType: parsed.amountType,
        sourceCurrency: parsed.sourceCurrency,
        destinationCurrency: parsed.destinationCurrency,
        priority: parsed.priority,
        paymentMode: parsed.paymentMode,
        explanation: parsed.explanation,
        missingFields: [],
        operationTimestamp: parsed.operationTimestamp,
        contextVersion: parsed.contextVersion
      },
      routeAnalysis,
      providerQuotes,
      assistantMessage: explanation.short
    });
  } catch (error) {
    next(error);
  }
};