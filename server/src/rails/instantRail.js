const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class InstantRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.REGIONAL_INSTANT);
  }
}

module.exports = new InstantRail();
