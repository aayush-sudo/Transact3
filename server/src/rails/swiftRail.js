const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class SwiftRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.SWIFT_BATCH);
  }
}

module.exports = new SwiftRail();
