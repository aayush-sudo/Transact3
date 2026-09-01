import React, { useState } from 'react';
import { Award, Play, CheckCircle2, TrendingDown, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import api from '../services/api';

const EvaluationBenchmarking = () => {
  const [loading, setLoading] = useState(false);
  const [batchSize, setBatchSize] = useState(100);
  const [evalResult, setEvalResult] = useState(null);

  const runEvaluation = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/orchestration/evaluate', { batchSize });
      setEvalResult(data.data);
    } catch (err) {
      console.error('Evaluation run failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-700/60 shadow-2xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">BENCHMARKING SUITE</span>
            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              Empirical AI Router Evaluation
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mt-1">System Evaluation & Performance Benchmarking</h3>
          <p className="text-xs text-gray-400 mt-0.5">Compare AI Multi-Rail Joint Router against single-rail baseline strategies using deterministic batch datasets</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold"
          >
            <option value={100}>100 Synthetic Payments</option>
            <option value={250}>250 Synthetic Payments</option>
            <option value={500}>500 Synthetic Payments</option>
          </select>

          <button
            onClick={runEvaluation}
            disabled={loading}
            className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs font-mono disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Running Simulation...</>
            ) : (
              <><Play size={15} /> Run Benchmark</>
            )}
          </button>
        </div>
      </div>

      {evalResult ? (
        <div className="space-y-5 animate-fadeIn">
          {/* Key Improvements Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-700/40 space-y-1">
              <span className="text-[11px] text-gray-400 font-semibold block">Cost Savings vs SWIFT</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">+{evalResult.improvements.costSavingsVsSwiftPct}%</span>
              <span className="text-[10px] text-gray-400 block font-mono">${evalResult.improvements.costSavingsUSDPerTx} saved / payment</span>
            </div>
            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-700/40 space-y-1">
              <span className="text-[11px] text-gray-400 font-semibold block">Latency Reduction</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">{evalResult.improvements.latencySavingsVsSwiftHours} hrs</span>
              <span className="text-[10px] text-gray-400 block font-mono">Hours saved vs SWIFT batch</span>
            </div>
            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-700/40 space-y-1">
              <span className="text-[11px] text-gray-400 font-semibold block">Bottleneck Avoidance Rate</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">{evalResult.improvements.bottleneckAvoidanceRatePct}%</span>
              <span className="text-[10px] text-gray-400 block font-mono">Capacity congestion avoided</span>
            </div>
            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-700/40 space-y-1">
              <span className="text-[11px] text-gray-400 font-semibold block">Timing Success Rate</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">{evalResult.improvements.timingSuccessRatePct}%</span>
              <span className="text-[10px] text-gray-400 block font-mono">FX conversion dip capture</span>
            </div>
          </div>

          {/* Benchmark Strategies Comparison Table */}
          <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700/40 space-y-3">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Strategy Comparison Matrix ({evalResult.batchSize} Simulated Payments)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-gray-700/60 text-gray-400">
                    <th className="py-2.5 px-3">Strategy Name</th>
                    <th className="py-2.5 px-3">Avg Total Cost</th>
                    <th className="py-2.5 px-3">Avg Latency</th>
                    <th className="py-2.5 px-3">Total Batch Cost</th>
                    <th className="py-2.5 px-3">Efficiency Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {Object.values(evalResult.strategies).map((strat) => {
                    const isAI = strat.name.includes('AI');
                    return (
                      <tr key={strat.name} className={isAI ? 'bg-emerald-500/10 font-bold text-emerald-300' : 'text-gray-300'}>
                        <td className="py-3 px-3 flex items-center gap-2">
                          {isAI && <Award size={14} className="text-emerald-400" />}
                          <span>{strat.name}</span>
                        </td>
                        <td className="py-3 px-3">${strat.avgCostUSD}</td>
                        <td className="py-3 px-3">{strat.avgLatencyHours}h</td>
                        <td className="py-3 px-3">${strat.totalCostUSD.toLocaleString()}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAI ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                            {isAI ? 'OPTIMAL (GRADE A+)' : 'BASELINE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/40 rounded-xl p-12 text-center border border-gray-700/30 space-y-3">
          <Award size={40} className="mx-auto text-emerald-400 opacity-60" />
          <h4 className="text-base font-bold text-white">Run System Benchmark Suite</h4>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Click "Run Benchmark" to execute synthetic batch payments across all 6 rails and compare the AI Joint Router against SWIFT-only, RTGS-only, and Greedy Cost baselines.
          </p>
        </div>
      )}
    </div>
  );
};

export default EvaluationBenchmarking;
