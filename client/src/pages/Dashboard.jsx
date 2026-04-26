import React, { useState } from 'react';
import CurrencyConverter from '../components/CurrencyConverter';
import HistoricalChart from '../components/HistoricalChart';
import NewsSection from '../components/NewsSection';

const Dashboard = () => {
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('EUR');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Overview</h1>
          <p className="text-slate-400">Real-time currency exchange and analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          <CurrencyConverter base={base} setBase={setBase} target={target} setTarget={setTarget} />
          <NewsSection />
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <HistoricalChart base={base} setBase={setBase} target={target} setTarget={setTarget} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
