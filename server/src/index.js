const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const { requestId } = require('./middleware/requestId');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Connect to database
connectDB();

const app = express();

// Security & Request tracking middleware
app.use(requestId);
app.use(rateLimiter({ windowMs: 60 * 1000, max: 120 }));
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Route files
const authRoutes = require('./routes/authRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const fxRoutes = require('./routes/fxRoutes');
const orchestrationRoutes = require('./routes/orchestrationRoutes');

// Mount routers
app.use('/api/user', authRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/fx', fxRoutes);
app.use('/api/orchestration', orchestrationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'TRANSACT3 AI-Driven Multi-Rail Payment Orchestration API is running',
    timestamp: new Date()
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`TRANSACT3 Server running on port ${PORT}`);
});
