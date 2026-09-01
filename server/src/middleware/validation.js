const currencyEngine = require('../services/currencyEngine');

const validatePaymentQuoteRequest = (req, res, next) => {
  const { sourceCurrency, destinationCurrency, amount } = req.body;

  if (!sourceCurrency || !destinationCurrency) {
    return res.status(400).json({ success: false, message: 'sourceCurrency and destinationCurrency are required' });
  }

  const curVal = currencyEngine.validateCurrencies(sourceCurrency, destinationCurrency);
  if (!curVal.valid) {
    return res.status(400).json({ success: false, message: curVal.message });
  }

  const amtVal = currencyEngine.validateAmount(Number(amount), sourceCurrency);
  if (!amtVal.valid) {
    return res.status(400).json({ success: false, message: amtVal.message });
  }

  next();
};

const validatePaymentExecuteRequest = (req, res, next) => {
  const { quoteId, receiverEmail } = req.body;

  if (!quoteId) {
    return res.status(400).json({ success: false, message: 'quoteId is required' });
  }
  if (!receiverEmail) {
    return res.status(400).json({ success: false, message: 'receiverEmail is required' });
  }

  next();
};

module.exports = {
  validatePaymentQuoteRequest,
  validatePaymentExecuteRequest
};
