const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Route files
const authRoutes = require('./routes/authRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const { router: blockchainRoutes } = require('./routes/blockchainRoutes');

// Mount routers
app.use('/api/user', authRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api', blockchainRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
