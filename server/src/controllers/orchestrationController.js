const orchestrationEngine = require('../services/orchestrationEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const liquidityManager = require('../services/liquidityManager');
const evaluationEngine = require('../services/evaluationEngine');
const railPricingService = require('../services/railPricingService');
const { isCurrencySupported } = require('../config/currencies');
const { getExchangeRates } = require('../services/currencyService');
const fxRateEngine = require('../services/fxRateEngine');
const predictiveFXExecutionAgent = require('../services/predictiveFXExecutionAgent');
const liquidityRebalancingAgent = require('../services/liquidityRebalancingAgent');
const complianceSentinelAgent = require('../services/complianceSentinelAgent');
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

const formatHourlyForecast = (forecast, source, destination) => {
  if (!forecast?.forecastAvailable || !forecast.predictions) {
    return `\nHourly forecast unavailable: ${forecast?.forecastUnavailableReason || 'Please try again.'}`;
  }
  const horizons = ['+6h', '+12h', '+24h', '+48h'];
  const estimates = horizons.map((horizon) => {
    const prediction = forecast.predictions[horizon];
    if (!prediction) return null;
    const bounds = prediction.low != null && prediction.high != null
      ? ` (approx. range ${formatRateValue(prediction.low)}–${formatRateValue(prediction.high)})`
      : '';
    return `${horizon}: ${formatRateValue(prediction.rate)}${bounds}`;
  }).filter(Boolean).join('; ');
  return `\nHourly estimates per 1 ${source} (${forecast.forecastProvider}, ${forecast.rateSource}): ${estimates} ${destination}.`
    + (forecast.forecastSource === 'mock'
      ? '\nThis is synthetic demo data, not a live market forecast.'
      : '')
    + `\nThese are experimental estimates, not calibrated confidence intervals or executable quotes.`;
};

const toIsoTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const User = require('../models/User');
const { isDemoVerificationEnabled } = require('../config/demoVerification');

exports.previewRoute = async (req, res, next) => {
  try {
    const {
      sourceCurrency = 'USD',
      destinationCurrency = 'EUR',
      amount = 10000,
      paymentMode = 'SEND_AMOUNT',
      priority = 'BALANCED',
      maxPermittedDelayHours = 24,
      receiverEmail
    } = req.body;
    let corridorContext = {};
    if (req.user && receiverEmail) {
      if (typeof receiverEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(receiverEmail.trim())) {
        return res.status(400).json({ success: false, message: 'Enter a valid recipient email' });
      }
      const recipient = await User.findOne({ email: receiverEmail.trim().toLowerCase() });
      if (!recipient) {
        return res.status(400).json({ success: false, message: 'Recipient account was not found' });
      }
      corridorContext = {
        senderCountry: req.user.accountCountry,
        recipientCountry: recipient.accountCountry,
        senderCountryVerified: req.user.accountCountryVerified,
        recipientCountryVerified: recipient.accountCountryVerified,
        senderCountryVerificationSource: req.user.accountCountryVerificationSource,
        recipientCountryVerificationSource: recipient.accountCountryVerificationSource,
        senderKycStatus: req.user.kycStatus,
        recipientKycStatus: recipient.kycStatus,
        senderKycVerificationSource: req.user.kycVerificationSource,
        recipientKycVerificationSource: recipient.kycVerificationSource,
        demoVerificationEnabled: isDemoVerificationEnabled()
      };
    }
    const result = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: Number(amount),
      paymentMode,
      priority,
      corridorContext,
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
    // AUTONOMOUS FX EXECUTION MANDATE (Agent 1)
    // ---------------------------------------------------------------------
    if (actionType === 'FX_MANDATE') {
      const userId = req.user ? (req.user._id || req.user.id) : 'anonymous';
      const isListQuery = /\b(list|active|show|check|status|my)\b/i.test(prompt) && !/\b(set|create|schedule|new|make)\b/i.test(prompt);

      if (isListQuery) {
        const mandates = predictiveFXExecutionAgent.getUserMandates(userId);
        if (mandates.length === 0) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'FX_MANDATE',
            assistantMessage: "You don't have any active autonomous FX execution mandates. You can create one by saying: 'Set an autonomous transfer of 1,000 USD to INR when rate improves by 0.5% within 24 hours'.",
            data: { mandates: [] }
          });
        }
        let msg = `You have ${mandates.length} autonomous FX mandate(s):\n\n`;
        mandates.forEach((m, idx) => {
          msg += `${idx + 1}. [${m.mandateId}] ${m.amount} ${m.sourceCurrency} -> ${m.destinationCurrency} | Status: ${m.status}\n`;
          msg += `   Target Rate: ${m.targetRate} (Initial: ${m.initialRate}) | Latest: ${m.latestRate} | Expires: ${new Date(m.expiresAt).toLocaleTimeString()}\n`;
          if (m.triggerReason) msg += `   Outcome: ${m.triggerReason}\n`;
        });
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_MANDATE',
          assistantMessage: msg,
          data: { mandates }
        });
      }

      const sourceCurrency = normalizeCurrency(parsed.sourceCurrency) || 'USD';
      const destinationCurrency = normalizeCurrency(parsed.destinationCurrency) || 'INR';
      const amount = parsed.amount || 1000;
      const pctMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%/);
      const targetImprovementPct = pctMatch ? parseFloat(pctMatch[1]) : 0.35;
      const hoursMatch = prompt.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i);
      const maxWaitHours = hoursMatch ? parseInt(hoursMatch[1], 10) : 24;

      const mandate = await predictiveFXExecutionAgent.createMandate({
        userId,
        sourceCurrency,
        destinationCurrency,
        amount,
        targetImprovementPct,
        maxWaitHours,
        priority: parsed.priority || 'BALANCED'
      });

      let msg = `Autonomous FX Execution Mandate Activated [${mandate.mandateId}]!\n\n`;
      msg += `• Corridor: ${mandate.amount} ${mandate.sourceCurrency} -> ${mandate.destinationCurrency}\n`;
      msg += `• Initial Spot Rate: 1 ${mandate.sourceCurrency} = ${mandate.initialRate} ${mandate.destinationCurrency}\n`;
      msg += `• Target Trigger Rate: >= ${mandate.targetRate} (+${mandate.targetImprovementPct}%)\n`;
      msg += `• Rate forecast: ${mandate.predictedTrend === 'UNAVAILABLE' ? 'not available; this mandate triggers only on observed reference rates' : mandate.predictedTrend}\n`;
      msg += `• Expiration Cutoff: ${new Date(mandate.expiresAt).toLocaleString()} (${mandate.maxWaitHours}h max)\n\n`;
      msg += `The Predictive FX Agent will monitor exchange rates continuously and trigger settlement automatically when your rate target is met or at cutoff window.`;

      return send({
        success: true,
        requiresClarification: false,
        actionType: 'FX_MANDATE',
        assistantMessage: msg,
        data: { mandate }
      });
    }

    // ---------------------------------------------------------------------
    // AUTONOMOUS RAIL & LIQUIDITY REBALANCING (Agent 2)
    // ---------------------------------------------------------------------
    if (actionType === 'LIQUIDITY_HEALTH') {
      const amountUSD = parsed.amount || 10000;
      const sourceCurrency = normalizeCurrency(parsed.sourceCurrency) || 'USD';
      const destinationCurrency = normalizeCurrency(parsed.destinationCurrency) || 'INR';

      const health = await liquidityRebalancingAgent.assessRailHealth(amountUSD);
      const plan = await liquidityRebalancingAgent.planRerouteOrRebalance({
        sourceCurrency,
        destinationCurrency,
        amountUSD,
        congestedRailId: health.rails.find(r => r.status && r.status.includes('CONGESTION'))?.railId || 'REGIONAL_INSTANT'
      });

      let msg = `Liquidity & Rail Optimization Diagnosis (${health.systemStatus}):\n\n`;
      health.rails.forEach((r) => {
        const icon = r.status === 'HEALTHY' ? '🟢' : (r.status.includes('CONGESTION') ? '🔴' : '🟡');
        msg += `${icon} ${r.name} (${r.railId}):\n`;
        msg += `   • Avail Liquidity: ${r.availableLiquidityUSD.toLocaleString()} USD | Saturation: ${r.saturationPct}%\n`;
        msg += `   • Status: ${r.status} - ${r.recommendation}\n\n`;
      });

      if (plan.hasProviderConfirmedMultiHop) {
        msg += `⚡ Provider-confirmed alternate route:\n`;
        msg += `👉 ${plan.graphPath.join(' -> ')} (Reference yield: ${plan.graphEffectiveRate}).\n`;
      } else {
        msg += `No provider-confirmed alternate route is available, so I won't recommend a multi-hop transfer.`;
      }

      return send({
        success: true,
        requiresClarification: false,
        actionType: 'LIQUIDITY_HEALTH',
        assistantMessage: msg,
        data: { health, plan }
      });
    }

    // ---------------------------------------------------------------------
    // COMPLIANCE & REGTECH SENTINEL (Agent 3)
    // ---------------------------------------------------------------------
    if (actionType === 'COMPLIANCE_AGENT') {
      const userId = req.user ? (req.user._id || req.user.id) : 'anonymous';
      const amountUSD = parsed.amount || 9850;
      const sourceCurrency = normalizeCurrency(parsed.sourceCurrency) || 'USD';
      const destinationCurrency = normalizeCurrency(parsed.destinationCurrency) || 'EUR';
      const recipientName = parsed.recipientName || 'Beneficiary';

      const chalMatch = prompt.match(/\b(CHAL-[A-Z0-9-]+)\b/i);
      const purposeMatch = prompt.match(/(?:purpose|justification|reason)[:\s]+([^.,\n]+)/i);

      if (chalMatch || purposeMatch) {
        const challengeId = chalMatch ? chalMatch[1] : (Array.from(complianceSentinelAgent.activeChallenges.keys())[0] || 'CHAL-LATEST');
        const purpose = purposeMatch ? purposeMatch[1] : 'Commercial Invoice Settlement';

        try {
          const resolution = await complianceSentinelAgent.resolveChallenge({
            challengeId,
            userId,
            commercialPurpose: purpose,
            sourceOfFunds: 'Corporate Operations',
            justificationNotes: prompt
          });
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'COMPLIANCE_AGENT',
            assistantMessage: `✅ Compliance Step-Up Verified!\n\n${resolution.message}\nAudit Hash & Justification inscribed into SHA-256 ledger. Risk level downgraded to [LOW].`,
            data: { resolution }
          });
        } catch (err) {
          // Fall through to screening
        }
      }

      const screening = await complianceSentinelAgent.screenTransaction({
        userId,
        amountUSD,
        sourceCurrency,
        destinationCurrency,
        recipientName,
        timeOfDayUTC: new Date().getUTCHours(),
        velocity24h: 1
      });

      let msg = `Compliance Sentinel Audit [Score: ${screening.compositeScore}/100 - Tier: ${screening.riskLevel}]:\n\n`;
      if (screening.triggers.length === 0) {
        msg += `🟢 No regulatory flags detected. Straight-Through Processing (STP) approved without friction.`;
      } else {
        msg += `⚠️ Active Regulatory Triggers:\n`;
        screening.triggers.forEach((t) => {
          msg += `• [${t.severity}] ${t.code}: ${t.description}\n`;
        });
        if (screening.challenge) {
          msg += `\n📋 Interactive Compliance Challenge [${screening.challenge.challengeId}]:\n`;
          msg += `Under Bank Secrecy Act (BSA) rules, transfers in this band require declared commercial purpose.\n`;
          msg += `Suggested Purposes: ${screening.challenge.suggestedPurposes.join(', ')}.\n\n`;
          msg += `You can resolve this now by replying: "Commercial purpose for ${screening.challenge.challengeId}: [Your Purpose]"`;
        }
      }

      return send({
        success: true,
        requiresClarification: false,
        actionType: 'COMPLIANCE_AGENT',
        assistantMessage: msg,
        data: { screening }
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
          const rateToUSD = Number(rates[code]);
          if (!Number.isFinite(rateToUSD) || rateToUSD <= 0) {
            throw new Error(`No USD reference rate is available for ${code}.`);
          }
          const valueInUSD = amount / rateToUSD;
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
        const currentRate = await fxForecastingEngine.predictFXMovements(source, destination);
        const rate = Number(currentRate.currentRate);
        if (!Number.isFinite(rate) || rate <= 0) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'CONVERT',
            assistantMessage: `I couldn't retrieve a ${source}/${destination} exchange rate right now. Please try again in a moment.`,
            data: null
          });
        }

        const timestamp = toIsoTimestamp(currentRate.rateDate || currentRate.forecastAsOf);
        const rateDescription = currentRate.forecastAvailable
          ? currentRate.forecastSource === 'mock'
            ? 'Demo hourly rate (not live)'
            : 'Current hourly rate'
          : 'Daily reference rate (hourly forecast unavailable)';
        const rateSource = currentRate.rateSource || 'hourly rate source';
        const amount = parsed.amount;

        if (amount == null) {
          return send({
            success: true,
            requiresClarification: false,
            actionType: 'CONVERT',
            parsed,
            assistantMessage: `1 ${source} = ${formatRateValue(rate)} ${destination}\n\nHow much would you like to convert? Give me an amount and I'll calculate it, for example: "Convert 100 ${source} to ${destination}".\n\n${rateDescription} as of ${timestamp} (${rateSource}), before any applicable transfer fees or provider spreads.`,
            data: {
              base: source,
              target: destination,
              amount: null,
              converted: null,
              rate,
              inverted: false,
              timestamp,
              rateSource,
              forecastAvailable: currentRate.forecastAvailable
            }
          });
        }

        const converted = Number((amount * rate).toFixed(2));
        const message = `${formatSourceAmount(amount, source)} = ${formatCurrencyAmount(converted, destination)}\n\nExchange rate: 1 ${source} = ${formatRateValue(rate)} ${destination}\n\n${rateDescription} as of ${timestamp} (${rateSource}). This is an indicative conversion, before any applicable transfer fees or provider spreads.`;

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
            rate,
            inverted: false,
            timestamp,
            rateSource,
            forecastAvailable: currentRate.forecastAvailable
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

        const amountLine = parsed.amount != null
          ? `\nAt the current hourly rate, ${formatCurrencyAmount(parsed.amount, source)} is about ${formatCurrencyAmount(parsed.amount * forecast.currentRate, destination)}.`
          : '';
        const forecastLine = formatHourlyForecast(forecast, source, destination);
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_FORECAST',
          parsed,
          assistantMessage: `FX outlook for ${source} → ${destination}\nCurrent ${forecast.forecastAvailable ? 'hourly rate' : 'reference rate'}: 1 ${source} = ${formatRateValue(forecast.currentRate)} ${destination}\nRate timestamp: ${forecast.rateDate || 'unavailable'} (${forecast.rateSource || 'hourly rate source'}).${forecastLine}${amountLine}\n\nHistorical reference rates can differ from more frequently updated indicative rates. Forecasts are not executable quotes or guarantees.`,
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
    // FX timing guidance requires a validated forecast provider.
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
        const nowAmount = Number((amount * currentRate).toFixed(2));
        const modelForecastLine = formatHourlyForecast(forecast, source, destination);
        return send({
          success: true,
          requiresClarification: false,
          actionType: 'FX_TIMING_ANALYSIS',
          parsed,
          assistantMessage: `Current ${forecast.forecastAvailable ? 'hourly rate' : 'reference rate'} for ${source} → ${destination}: 1 ${source} = ${formatRateValue(currentRate)} ${destination} (as of ${forecast.rateDate || 'unavailable'}, ${forecast.rateSource || 'hourly rate source'}).\nIf you convert now, ${amountIsAssumed ? `1 ${source}` : formatCurrencyAmount(amount, source)} is about ${formatCurrencyAmount(nowAmount, destination)} before provider fees and spreads.${modelForecastLine}\n\nForecasts do not recommend waiting or execute a transfer.`,
          data: {
            source,
            destination,
            amount: parsed.amount,
            amountAssumed: amountIsAssumed,
            currentRate,
            rateDate: forecast.rateDate,
            rateSource: forecast.rateSource,
            forecastAvailable: forecast.forecastAvailable,
            forecastRate: forecast.forecastRate,
            forecastReturnPct: forecast.forecastReturnPct,
            confidencePct: forecast.confidencePct,
            historicalValidation: forecast.historicalValidation,
            predictions: forecast.predictions,
            nowAmount,
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
    const directRate = await fxRateEngine.getIndicativeConversion(
      parsed.sourceCurrency,
      parsed.destinationCurrency
    );
    const sourcePrecision = currencyConfig[parsed.sourceCurrency]?.precision ?? 2;
    const destinationPrecision = currencyConfig[parsed.destinationCurrency]?.precision ?? 2;
    const recipientGetsAmount = parsed.paymentMode === 'RECIPIENT_GETS';
    const routeComparison = {
      status: 'EXECUTABLE_HOP_COMPARISON_UNAVAILABLE',
      directReferenceQuote: directRate ? {
        sourceAmount: Number((recipientGetsAmount
          ? parsed.amount / directRate.rate
          : parsed.amount).toFixed(sourcePrecision)),
        sourceCurrency: parsed.sourceCurrency,
        destinationAmount: Number((recipientGetsAmount
          ? parsed.amount
          : parsed.amount * directRate.rate).toFixed(destinationPrecision)),
        destinationCurrency: parsed.destinationCurrency,
        rate: directRate.rate,
        rateSource: directRate.rateSource,
        rateTimestamp: toIsoTimestamp(directRate.timestamp)
      } : null,
      hopRoutes: [],
      message: 'A reference FX rate does not confirm route availability, leg-level fees, or settlement. No intermediate-currency route is recommended until a payment provider supplies executable quotes.'
    };

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
        recipientEmail: parsed.recipientEmail || null,
        explanation: parsed.explanation,
        missingFields: [],
        operationTimestamp: parsed.operationTimestamp,
        contextVersion: parsed.contextVersion
      },
      routeAnalysis,
      routeComparison,
      providerQuotes,
      assistantMessage: explanation.short
    });
  } catch (error) {
    next(error);
  }
};
// =====================================================================
// MULTI-AGENT PROGRAMMATIC ENDPOINTS
// =====================================================================
exports.createFXMandate = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : 'anonymous';
    const mandate = await predictiveFXExecutionAgent.createMandate({ ...req.body, userId });
    res.status(201).json({ success: true, data: mandate });
  } catch (err) {
    next(err);
  }
};

exports.getFXMandates = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandates = predictiveFXExecutionAgent.getUserMandates(userId);
    res.status(200).json({ success: true, data: mandates });
  } catch (err) {
    next(err);
  }
};

exports.evaluateFXMandates = async (req, res, next) => {
  try {
    const results = await predictiveFXExecutionAgent.evaluateAllActiveMandates();
    res.status(200).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

exports.cancelFXMandate = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const mandate = predictiveFXExecutionAgent.cancelMandate(req.params.id, userId);
    res.status(200).json({ success: true, data: mandate });
  } catch (err) {
    next(err);
  }
};

exports.getLiquidityHealth = async (req, res, next) => {
  try {
    const amountUSD = Number(req.query.amountUSD) || 10000;
    const health = await liquidityRebalancingAgent.assessRailHealth(amountUSD);
    res.status(200).json({ success: true, data: health });
  } catch (err) {
    next(err);
  }
};

exports.planLiquidityReroute = async (req, res, next) => {
  try {
    const plan = await liquidityRebalancingAgent.planRerouteOrRebalance(req.body);
    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};

exports.screenCompliance = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : 'anonymous';
    const result = await complianceSentinelAgent.screenTransaction({ ...req.body, userId });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.resolveComplianceChallenge = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : 'anonymous';
    const result = await complianceSentinelAgent.resolveChallenge({ ...req.body, userId });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
