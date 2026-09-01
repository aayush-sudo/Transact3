import React from 'react';
import { DollarSign, Percent, TrendingDown, Award } from 'lucide-react';

const TCAAnalytics = ({ tca, aiSavingsUSD = 0 }) => {
  if (!tca) return null;

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 border border-gray-700/60 shadow-xl space-y-3 font-mono">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-2">
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Transaction Cost Analysis (TCA)</span>
        {aiSavingsUSD > 0 && (
          <span className="text-xs font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
            <Award size={12} /> AI Savings: ${aiSavingsUSD}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-700/40">
          <span className="text-[10px] text-gray-400 block font-semibold">Total Cost</span>
          <span className="text-sm font-bold text-white">${tca.totalCostUSD}</span>
        </div>
        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-700/40">
          <span className="text-[10px] text-gray-400 block font-semibold">Total Cost (bps)</span>
          <span className="text-sm font-bold text-emerald-400">{tca.totalCostBps} bps</span>
        </div>
        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-700/40">
          <span className="text-[10px] text-gray-400 block font-semibold">FX Spread</span>
          <span className="text-sm font-bold text-gray-200">{tca.spreadBps} bps</span>
        </div>
        <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-700/40">
          <span className="text-[10px] text-gray-400 block font-semibold">FX Slippage</span>
          <span className="text-sm font-bold text-gray-200">{tca.fxSlippageBps} bps</span>
        </div>
      </div>
    </div>
  );
};

export default TCAAnalytics;
