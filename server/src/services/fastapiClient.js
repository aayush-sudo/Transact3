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
