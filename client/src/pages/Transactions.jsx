import React, { useState, useEffect } from 'react';
import TransactionHistory from '../components/TransactionHistory';
import TransactionTimeline from '../components/TransactionTimeline';
import api from '../services/api';

const Transactions = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
          LIFECYCLE & IMMUTABLE LEDGER RECORDS
        </p>
        <h1 className="text-3xl font-extrabold text-white">Transactions & Audit History</h1>
      </div>

      <TransactionTimeline currentStatus="COMPLETED" />
      <TransactionHistory />
    </div>
  );
};

export default Transactions;
