const assert = require('node:assert/strict');
const test = require('node:test');
const { getInstantEligibility } = require('./src/services/settlementPolicy');
const { isDemoVerificationEnabled } = require('./src/config/demoVerification');

const verifiedDomesticIndia = {
  senderCountry: 'IN',
  recipientCountry: 'IN',
  senderCountryVerified: true,
  recipientCountryVerified: true,
  senderCountryVerificationSource: 'DEMO',
  recipientCountryVerificationSource: 'DEMO',
  senderKycStatus: 'VERIFIED',
  recipientKycStatus: 'VERIFIED',
  senderKycVerificationSource: 'DEMO',
  recipientKycVerificationSource: 'DEMO',
  demoVerificationEnabled: true
};

test('allows an in-limit same-country payment only with verified accounts and KYC', () => {
  const result = getInstantEligibility('INR', 'INR', 500, verifiedDomesticIndia);

  assert.equal(result.eligible, true);
  assert.equal(result.clearingRail, 'UPI / IMPS (modeled)');
  assert.equal(result.corridorAssessment.classification, 'DOMESTIC');
  assert.equal(result.corridorAssessment.countryEvidence, 'DEMO_VERIFIED');
});

test('classifies missing or cross-country account endpoints without allowing domestic instant', () => {
  const missing = getInstantEligibility('INR', 'INR', 100);
  const crossBorder = getInstantEligibility('INR', 'INR', 100, {
    ...verifiedDomesticIndia,
    recipientCountry: 'US'
  });

  assert.equal(missing.corridorAssessment.classification, 'UNKNOWN');
  assert.equal(missing.eligible, false);
  assert.equal(crossBorder.corridorAssessment.classification, 'CROSS_BORDER');
  assert.equal(crossBorder.eligible, false);
});

test('requires trusted country evidence and KYC even when declared countries match', () => {
  const unverifiedCountry = getInstantEligibility('INR', 'INR', 100, {
    ...verifiedDomesticIndia,
    senderCountryVerified: false
  });
  const unverifiedKyc = getInstantEligibility('INR', 'INR', 100, {
    ...verifiedDomesticIndia,
    recipientKycStatus: 'NOT_STARTED'
  });

  assert.match(unverifiedCountry.reason, /verified account-country evidence/i);
  assert.match(unverifiedKyc.reason, /trusted KYC verification/i);

  const demoDisabled = getInstantEligibility('INR', 'INR', 100, {
    ...verifiedDomesticIndia,
    demoVerificationEnabled: false
  });
  assert.equal(demoDisabled.eligible, false);
  assert.match(demoDisabled.reason, /demo mode is enabled/i);
});

test('rejects FX conversion, unsupported local rails, and amounts above the demo limit', () => {
  const fx = getInstantEligibility('USD', 'INR', 100, verifiedDomesticIndia);
  const unsupportedRail = getInstantEligibility('JPY', 'JPY', 100, {
    ...verifiedDomesticIndia,
    senderCountry: 'JP',
    recipientCountry: 'JP'
  });
  const overLimit = getInstantEligibility('INR', 'INR', 1001, verifiedDomesticIndia);

  assert.match(fx.reason, /currencies to match/i);
  assert.match(unsupportedRail.reason, /no configured domestic instant clearing rail/i);
  assert.match(overLimit.reason, /demo instant-rail limit/i);
});

test('demo verification can never be enabled in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoFlag = process.env.DEMO_KYC_ENABLED;

  try {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_KYC_ENABLED = 'true';
    assert.equal(isDemoVerificationEnabled(), false);

    process.env.NODE_ENV = 'development';
    process.env.DEMO_KYC_ENABLED = 'false';
    assert.equal(isDemoVerificationEnabled(), false);

    delete process.env.DEMO_KYC_ENABLED;
    assert.equal(isDemoVerificationEnabled(), true);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalDemoFlag === undefined) delete process.env.DEMO_KYC_ENABLED;
    else process.env.DEMO_KYC_ENABLED = originalDemoFlag;
  }
});
