const mongoose = require('mongoose');

const PortfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  holdings: [
    {
      currency: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        default: 0
      },
      averageBuyPrice: {
        type: Number,
        required: true,
        default: 1 // Relative to base currency (e.g. USD)
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', PortfolioSchema);
