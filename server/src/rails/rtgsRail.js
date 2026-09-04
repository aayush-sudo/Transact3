const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class RtgsRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.RTGS_INSTANT);
  }

  isRtgsWindowOpen(now = new Date()) {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    // Closed on weekends
    if (day === 0 || day === 6) {
      const hoursUntilMonday = day === 6 ? (48 - hour + 8) : (24 - hour + 8);
      return { isOpen: false, reason: 'RTGS Central Bank Wire Closed (Weekend)', delayHours: hoursUntilMonday };
    }

    // Operating hours 07:00 to 18:00 UTC
    if (hour < 7 || hour >= 18) {
      const hoursUntilOpen = hour >= 18 ? (24 - hour + 7) : (7 - hour);
      return { isOpen: false, reason: 'RTGS Central Bank Wire Closed (After-Hours)', delayHours: hoursUntilOpen };
    }

    return { isOpen: true, delayHours: 0 };
  }

  estimateLatency(options = {}) {
    const window = this.isRtgsWindowOpen(options.currentTime || new Date());
    if (!window.isOpen) {
      return parseFloat((this.config.avgLatencyHours + window.delayHours).toFixed(2));
    }
    return this.config.avgLatencyHours;
  }
}

module.exports = new RtgsRail();
