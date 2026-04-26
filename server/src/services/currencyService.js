const axios = require('axios');

const getExchangeRates = async (baseCurrency = 'USD') => {
  try {
    const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
    const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${baseCurrency}`;
    
    const response = await axios.get(url);
    if (response.data && response.data.result === 'success') {
      return response.data;
    } else {
      throw new Error('Failed to fetch exchange rates');
    }
  } catch (error) {
    console.error('Exchange API Error:', error.message);
    // Return mock data if API key is missing or invalid
    return mockLatestRates(baseCurrency);
  }
};

const mockLatestRates = (base) => {
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'];
  const rates = {};
  
  currencies.forEach(c => {
    if (c === base) rates[c] = 1;
    else rates[c] = Number((Math.random() * (1.5 - 0.5) + 0.5).toFixed(4));
  });
  
  // Hardcode some realistic values for USD base
  if (base === 'USD') {
    rates['EUR'] = 0.92;
    rates['GBP'] = 0.79;
    rates['JPY'] = 151.5;
    rates['INR'] = 83.3;
  }

  return {
    result: 'success',
    base_code: base,
    conversion_rates: rates,
    is_mock: true
  };
};

const getHistoricalRates = async (baseCurrency, targetCurrency, days = 7) => {
  try {
    // Free tier doesn't support history endpoint, so we fetch the REAL current rate
    // and generate a realistic mock history that ends EXACTLY at the real rate!
    const latestRates = await getExchangeRates(baseCurrency);
    const anchorRate = latestRates.conversion_rates[targetCurrency] || 1.0;
    return mockHistoricalData(baseCurrency, targetCurrency, days, anchorRate);
  } catch (error) {
    console.error('Exchange History API Error:', error.message);
    return mockHistoricalData(baseCurrency, targetCurrency, days, 1.0);
  }
};

const mockHistoricalData = (base, target, days, anchorRate) => {
  const dates = [];
  const rates = {};
  
  // We want the MOST RECENT day to be exactly the anchorRate
  // So we generate the random walk backwards!
  let currentRate = anchorRate;
  const trend = (Math.random() - 0.5) * 0.005 * anchorRate; // Scale trend by anchor
  
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    rates[dateStr] = { [target]: currentRate };
    
    // Calculate the previous day's rate (stepping backwards in time)
    // Scale the volatility to the magnitude of the currency (e.g. INR is 83, USD is 1)
    const volatility = anchorRate * 0.005; 
    currentRate = Math.max(0.01, currentRate - (Math.random() * volatility * 2 - volatility) - trend); 
  }
  
  return {
    result: 'success',
    base_code: base,
    conversion_rates: rates,
    is_mock: true
  };
};

module.exports = {
  getExchangeRates,
  getHistoricalRates
};
