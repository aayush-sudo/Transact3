const axios = require('axios');

const FASTAPI_BASE_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
const TIMEOUT_MS = 1500;

class FastApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: FASTAPI_BASE_URL,
      timeout: TIMEOUT_MS
    });
  }

  async isHealthy() {
    try {
      const res = await this.client.get('/health', { timeout: 800 });
      return res.status === 200 && res.data && res.data.status === 'healthy';
    } catch (e) {
      return false;
    }
  }

  async analyzeRoute(payload) {
    try {
      const res = await this.client.post('/route/analyze', payload);
      if (res.status === 200 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (err) {
      // Fallback will be used
    }
    return { success: false, fallback: true };
  }

  async analyzeFX(payload) {
    try {
      const res = await this.client.post('/fx/analyze', payload);
      if (res.status === 200 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (err) {
      // Fallback will be used
    }
    return { success: false, fallback: true };
  }

  async predictCurrency(payload) {
    const res = await this.client.post('/ml/predict-currency', payload, { timeout: 8000 });
    if (res.status !== 200 || !res.data?.success || !res.data?.data) {
      throw new Error('FX model service returned an invalid prediction response.');
    }
    return res.data.data;
  }

  async calculateTCA(payload) {
    try {
      const res = await this.client.post('/tca/calculate', payload);
      if (res.status === 200 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (err) {
      // Fallback will be used
    }
    return { success: false, fallback: true };
  }
}

module.exports = new FastApiClient();
