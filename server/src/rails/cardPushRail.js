const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class CardPushRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.CARD_PUSH);
  }
}

module.exports = new CardPushRail();
