function isDemoVerificationEnabled() {
  return process.env.DEMO_KYC_ENABLED !== 'false' && process.env.NODE_ENV !== 'production';
}

module.exports = { isDemoVerificationEnabled };
