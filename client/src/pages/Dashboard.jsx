import React, { useState } from 'react';
import CurrencyConverter from '../components/CurrencyConverter';
import HistoricalChart from '../components/HistoricalChart';
import WalletSection from '../components/WalletSection';
import AiInsights from '../components/AiInsights';
import SendMoney from '../components/SendMoney';
import BlockchainViewer from '../components/BlockchainViewer';
import TransactionHistory from '../components/TransactionHistory';

const Dashboard = () => {
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('INR');
  const [lastTx, setLastTx] = useState(null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-velto-muted uppercase mb-1">DIGITAL WALLET & FINANCIAL SERVICES</p>
          <h1 className="text-3xl font-bold text-velto-ink">Dashboard</h1>
        </div>
      </div>

      {/* Row 1: Wallet, Currency Converter, AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WalletSection />
        <CurrencyConverter base={base} setBase={setBase} target={target} setTarget={setTarget} />
        <AiInsights base={base} target={target} />
      </div>

      {/* Row 2: Send Money + Historical Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <SendMoney onTransactionComplete={(tx) => setLastTx(tx)} />
        </div>
        <div className="lg:col-span-2">
          <HistoricalChart base={base} setBase={setBase} target={target} setTarget={setTarget} />
        </div>
      </div>

      {/* Row 3: Transaction History (Blockchain Viewer hidden) */}
      <div className="grid grid-cols-1 gap-6">
        {/* <BlockchainViewer newTransaction={lastTx} /> */}
        <TransactionHistory />
      </div>
    </div>
  );
};

export default Dashboard;
