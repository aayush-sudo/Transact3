const express = require('express');
const router = express.Router();
const { Blockchain } = require('../utils/blockchain');

const transactChain = new Blockchain();

// GET /api/blockchain - Return full blockchain
router.get('/blockchain', (req, res) => {
  res.status(200).json(transactChain.chain);
});

// GET /api/mine - Mine pending transactions and return newly created block
router.get('/mine', (req, res) => {
  const block = transactChain.minePendingTransactions();
  res.status(200).json(block);
});

module.exports = { router, transactChain };
