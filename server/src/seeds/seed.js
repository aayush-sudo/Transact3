const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const FXQuote = require('../models/FXQuote');
const IdempotencyRecord = require('../models/IdempotencyRecord');
const WalletFunding = require('../models/WalletFunding');
const liquidityManager = require('../services/liquidityManager');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');

const defaultHoldings = (balances = {}) => SUPPORTED_CURRENCY_CODES.map(currency => ({
  currency,
  amount: balances[currency] != null ? balances[currency] : 10000,
  averageBuyPrice: 1
}));

async function seedTestAccounts() {
  const testUsers = [
    {
      name: 'Alice Chen',
      email: 'alice@transact3.com',
      password: 'Password123!',
      role: 'USER',
      balances: { USD: 25000, EUR: 20000, GBP: 15000, INR: 500000, SGD: 20000, JPY: 2000000 }
    },
    {
      name: 'Bob Miller',
      email: 'bob@transact3.com',
      password: 'Password123!',
      role: 'USER',
      balances: { USD: 15000, EUR: 15000, GBP: 10000, INR: 350000, SGD: 15000, JPY: 1500000 }
    },
    {
      name: 'Charlie Davis',
      email: 'charlie@transact3.com',
      password: 'Password123!',
      role: 'USER',
      balances: { USD: 50000, EUR: 40000, GBP: 30000, INR: 1000000, SGD: 50000, JPY: 5000000 }
    },
    {
      name: 'Treasury Admin',
      email: 'treasury@transact3.io',
      password: 'Password123!',
      role: 'ADMIN',
      balances: { USD: 1000000, EUR: 1000000, GBP: 1000000, INR: 50000000, SGD: 1000000, JPY: 100000000 }
    }
  ];

  for (const data of testUsers) {
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        walletBalance: data.balances.USD || 10000
      });
      console.log(`[Seed] Created user: ${data.name} (${data.email})`);
    } else {
      user.name = data.name;
      user.role = data.role;
      user.walletBalance = data.balances.USD || 10000;
      await user.save();
    }

    const holdings = defaultHoldings(data.balances);
    await Portfolio.findOneAndUpdate(
      { user: user._id },
      { $set: { holdings } },
      { upsert: true, returnDocument: 'after' }
    );
  }
}

const seedDatabase = async ({ testFixtures = true } = {}) => {
  await liquidityManager.initialize();
  await seedTestAccounts();
  console.log('[Seed] Database initialization and accounts seeded successfully');
};

module.exports = seedDatabase;

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB()
    .then(() => seedDatabase({ testFixtures: true }))
    .then(() => {
      console.log('[Seed] Complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
