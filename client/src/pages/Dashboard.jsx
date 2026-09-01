import React, { useState } from 'react';
import MultiRailRouter from '../components/MultiRailRouter';
import FXForecastChart from '../components/FXForecastChart';
import RailStatusViewer from '../components/RailStatusViewer';
import CurrencyConverter from '../components/CurrencyConverter';
import AiInsights from '../components/AiInsights';
import WalletSection from '../components/WalletSection';

const Dashboard = () => {
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('EUR');
  const [lastTx, setLastTx] = useState(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
            TRANSACT3 · INSTITUTIONAL PAYMENT ORCHESTRATION
          </p>
          <h1 className="text-3xl font-extrabold text-white">Payment Orchestration Dashboard</h1>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WalletSection />
        <CurrencyConverter base={base} setBase={setBase} target={target} setTarget={setTarget} />
        <AiInsights base={base} target={target} />
      </div>

      {/* Main Orchestration + FX Forecast Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MultiRailRouter onTransactionComplete={(tx) => setLastTx(tx)} />
        </div>
        <div className="lg:col-span-1">
          <FXForecastChart base={base} target={target} />
        </div>
      </div>

      {/* Rail Status Liquidity Monitor */}
      <div className="grid grid-cols-1 gap-6">
        <RailStatusViewer />
      </div>
    </div>
  );
};

export default Dashboard;
