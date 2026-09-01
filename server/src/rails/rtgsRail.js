const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class RtgsRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.RTGS_INSTANT);
  }
}

module.exports = new RtgsRail();
