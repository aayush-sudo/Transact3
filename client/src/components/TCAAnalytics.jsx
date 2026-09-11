import React from 'react';
import { DollarSign, Award, Clock, ArrowDownRight, Layers } from 'lucide-react';

const TCAAnalytics = ({ tca, aiSavingsUSD = 0 }) => {
  if (!tca) return null;

  const routeFee = tca.routeFeeUSD ?? tca.railFeeUSD ?? 0;
  const fxCost = tca.fxCostUSD ?? 0;
  const totalCost = tca.totalEstimatedCostUSD ?? tca.totalCostUSD ?? (routeFee + fxCost);
  const costSaved = tca.costSavedUSD ?? aiSavingsUSD ?? 0;
  const swiftBase = tca.swiftBaselineCostUSD ?? (totalCost + costSaved);
  const timeSaved = tca.timeSavedHours ?? 35.9;

  const fxShare = tca.breakdownPct?.fxShare ?? (totalCost > 0 ? Math.round((fxCost / totalCost) * 100) : 50);
  const railShare = tca.breakdownPct?.railShare ?? (totalCost > 0 ? Math.round((routeFee / totalCost) * 100) : 50);

  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-950 border border-gray-800 rounded-2xl p-5 shadow-2xl space-y-4 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-emerald-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Transaction Cost Analysis (TCA) & SWIFT Benchmark
          </span>
        </div>
        {costSaved > 0 && (
          <span className="text-xs font-extrabold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <Award size={13} className="text-emerald-400" />
            Saved ${costSaved.toFixed(2)} vs SWIFT Baseline
          </span>
        )}
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Route Fee */}
        <div className="bg-gray-950/70 p-3 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-semibold uppercase">Route Clearing Fee</span>
          <span className="text-base font-black text-white mt-0.5 block">${Number(routeFee).toFixed(2)}</span>
          <span className="text-[10px] text-gray-500">{railShare}% of total cost</span>
        </div>

        {/* FX Spread Cost */}
        <div className="bg-gray-950/70 p-3 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-semibold uppercase">FX Spread Cost</span>
          <span className="text-base font-black text-amber-400 mt-0.5 block">${Number(fxCost).toFixed(2)}</span>
          <span className="text-[10px] text-gray-500">{fxShare}% ({tca.spreadBps || 30} bps spread)</span>
        </div>

        {/* Total Cost */}
        <div className="bg-gray-950/70 p-3 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-semibold uppercase">Total Executed Cost</span>
          <span className="text-base font-black text-emerald-400 mt-0.5 block">${Number(totalCost).toFixed(2)}</span>
          <span className="text-[10px] text-emerald-500">{tca.totalCostBps || Math.round((totalCost / (tca.sourceAmountUSD || 1000)) * 10000)} bps</span>
        </div>

        {/* SWIFT Baseline Comparison */}
        <div className="bg-gray-950/70 p-3 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 block font-semibold uppercase">SWIFT Correspondent Benchmark</span>
          <span className="text-base font-black text-gray-400 mt-0.5 block line-through decoration-rose-500/70">${Number(swiftBase).toFixed(2)}</span>
          <span className="text-[10px] text-emerald-400 font-bold">-{costSaved > 0 ? Math.round((costSaved / swiftBase) * 100) : 0}% Cost Reduction</span>
        </div>
      </div>

      {/* Latency & Slippage Details */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-950/40 p-3 rounded-xl border border-gray-800/60 text-xs">
        <div className="flex items-center gap-2 text-gray-300">
          <Clock size={14} className="text-indigo-400 flex-shrink-0" />
          <span>
            Settlement Speed Advantage: <strong className="text-white">~{Number(timeSaved).toFixed(1)} hours saved</strong> vs typical ~36-hour SWIFT correspondent clearing
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>Slippage: <strong className="text-gray-200">{tca.fxSlippageBps || 0} bps</strong></span>
          <span>Execution: <strong className="text-emerald-400">Optimal</strong></span>
        </div>
      </div>
    </div>
  );
};

export default TCAAnalytics;
