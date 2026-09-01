const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class NettingRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.NETTING_LEDGER);
  }
}

module.exports = new NettingRail();
