import React, { useState, useEffect } from 'react';
import FXForecastChart from '../components/FXForecastChart';
import FXTimingBadge from '../components/FXTimingBadge';
import api from '../services/api';
import { TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'AED', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'ZAR'];

const FXForecasting = () => {
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('INR');
  const [backtest, setBacktest] = useState(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);

  useEffect(() => {
    fetchBacktest();
  }, [base, target]);

  const fetchBacktest = async () => {
    setLoadingBacktest(true);
    try {
      const { data } = await api.post('/fx/backtest', {
        baseCurrency: base,
        targetCurrency: target,
        days: 30
      });
      setBacktest(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBacktest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
            PREDICTIVE TIME-SERIES FX FORECASTING ENGINE
          </p>
          <h1 className="text-3xl font-extrabold text-white">FX Forecasting & Backtesting</h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-gray-400 text-xs font-mono">→</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-emerald-400 rounded-xl px-3 py-2 text-xs font-mono font-bold"
          >
            {CURRENCIES.filter(c => c !== base).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FXForecastChart base={base} target={target} />
        </div>

        {/* Backtesting Accuracy Panel */}
        <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Model Backtest Validation</h3>
            </div>
            <span className="text-[10px] text-gray-400 font-bold">30-Day Evaluation</span>
          </div>

          {backtest ? (
            <div className="space-y-3">
              <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30">
                <span className="text-[10px] text-gray-400 block">Directional Accuracy</span>
                <span className="text-xl font-bold text-emerald-400">{backtest.metrics.directionalAccuracyPct}%</span>
              </div>
              <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30">
                <span className="text-[10px] text-gray-400 block">Timing Success Rate</span>
                <span className="text-xl font-bold text-emerald-400">{backtest.metrics.timingSuccessRatePct}%</span>
              </div>
              <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30">
                <span className="text-[10px] text-gray-400 block">Mean Absolute Error (MAE)</span>
                <span className="text-lg font-bold text-gray-200">{backtest.metrics.maePct}%</span>
              </div>
              <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30">
                <span className="text-[10px] text-gray-400 block">Average Yield Savings</span>
                <span className="text-lg font-bold text-emerald-400">+{backtest.metrics.avgSavingsBps} bps</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Loading Backtest Data...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FXForecasting;
