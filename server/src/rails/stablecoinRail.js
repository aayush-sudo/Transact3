const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class StablecoinRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.STABLECOIN_VAULT);
  }
}

module.exports = new StablecoinRail();
