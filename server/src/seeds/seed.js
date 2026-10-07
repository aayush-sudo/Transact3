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
const { provisionNewUserWallet } = require('../services/walletProvisioning');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');

const LEGACY_DEMO_EMAILS = [
  'alice@transact3.com',
  'bob@transact3.com',
  'treasury@transact3.io'
];

const emptyHoldings = () => SUPPORTED_CURRENCY_CODES.map(currency => ({
  currency,
  amount: 0,
  averageBuyPrice: 1
}));

async function removeLegacyAccounts() {
  const users = await User.find({ email: { $in: LEGACY_DEMO_EMAILS } }).select('_id');
  if (users.length === 0) return;
  const userIds = users.map(user => user._id);
  const transactions = await Transaction.find({
    $or: [{ sender: { $in: userIds } }, { recipient: { $in: userIds } }]
  }).select('_id');
  const transactionIds = transactions.map(transaction => String(transaction._id));
  if (transactionIds.length) {
    await LedgerEntry.deleteMany({
      $or: [
        { transactionId: { $in: transactions.map(transaction => transaction._id) } },
        { userId: { $in: userIds } }
      ]
    });
    await AuditLog.deleteMany({ transactionId: { $in: transactionIds } });
    await Transaction.deleteMany({ _id: { $in: transactions.map(transaction => transaction._id) } });
  } else {
    await LedgerEntry.deleteMany({ userId: { $in: userIds } });
  }
  await FXQuote.deleteMany({ $or: [{ userId: { $in: userIds } }, { recipientId: { $in: userIds } }] });
  await IdempotencyRecord.deleteMany({ userId: { $in: userIds } });
  await WalletFunding.deleteMany({ userId: { $in: userIds } });
  await Portfolio.deleteMany({ user: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

async function seedBootstrapAccounts() {
  const accounts = [
    {
      name: process.env.BOOTSTRAP_USER_1_NAME || 'Aayush',
      email: process.env.BOOTSTRAP_USER_1_EMAIL || 'aayush@gmail.com',
      password: process.env.BOOTSTRAP_USER_1_PASSWORD
    },
    {
      name: process.env.BOOTSTRAP_USER_2_NAME || 'Anirudh',
      email: process.env.BOOTSTRAP_USER_2_EMAIL || 'anirudh@gmail.com',
      password: process.env.BOOTSTRAP_USER_2_PASSWORD
    }
  ];
  if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    accounts.push({
      name: process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator',
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      role: 'ADMIN'
    });
  }

  for (const account of accounts) {
    if (!account.password) continue;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/.test(account.password) ||
      Buffer.byteLength(account.password, 'utf8') > 72) {
      throw new Error(`Bootstrap password for ${account.email} does not meet password policy.`);
    }
    const email = account.email.toLowerCase().trim();
    if (await User.exists({ email })) continue;
    const user = await User.create({
      name: account.name,
      email,
      password: account.password,
      role: account.role || 'USER',
      walletBalance: 0
    });
    await provisionNewUserWallet(user);
  }
}

async function seedTestAccounts() {
  const testUsers = [
    { name: 'Test Sender', email: 'alice@transact3.com', password: 'Password123!', walletBalance: 10000 },
    { name: 'Test Recipient', email: 'bob@transact3.com', password: 'Password123!', walletBalance: 5000 },
    { name: 'Test Admin', email: 'treasury@transact3.io', password: 'Password123!', walletBalance: 0, role: 'ADMIN' }
  ];
  for (const data of testUsers) {
    let user = await User.findOne({ email: data.email });
    if (!user) user = await User.create(data);
    const holdings = emptyHoldings();
    holdings.find(holding => holding.currency === 'USD').amount = data.walletBalance;
    holdings.find(holding => holding.currency === 'INR').amount = data.email.startsWith('bob@') ? 50000 : 0;
    await Portfolio.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { holdings } },
      { upsert: true }
    );
  }
}

const seedDatabase = async ({ testFixtures = false } = {}) => {
  await liquidityManager.initialize();
  if (testFixtures) {
    await seedTestAccounts();
    return;
  }
  await removeLegacyAccounts();
  await seedBootstrapAccounts();
};

module.exports = seedDatabase;

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(() => seedDatabase()).then(() => process.exit(0));
}
