import { useState, useEffect, useCallback } from 'react';
import FXForecastChart from '../components/FXForecastChart';
import api from '../services/api';
import { ArrowRightLeft, BarChart2, Calculator, Loader2 } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'AED', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'ZAR'];
const CONVERTER_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

const FXForecasting = () => {
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('INR');
  const [backtest, setBacktest] = useState(null);
  const [converterBase, setConverterBase] = useState('USD');
  const [converterTarget, setConverterTarget] = useState('INR');
  const [converterAmount, setConverterAmount] = useState('100');
  const [conversion, setConversion] = useState(null);
  const [conversionError, setConversionError] = useState('');
  const [converting, setConverting] = useState(false);

  const fetchBacktest = useCallback(async () => {
    try {
      const { data } = await api.post('/fx/backtest', {
        baseCurrency: base,
        targetCurrency: target,
        days: 30
      });
      setBacktest(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [base, target]);

  useEffect(() => {
    const initialFetch = setTimeout(fetchBacktest, 0);
    return () => clearTimeout(initialFetch);
  }, [fetchBacktest]);

  const convertAmount = async (event) => {
    event.preventDefault();
    setConverting(true);
    setConversionError('');
    try {
      const { data } = await api.post('/currency/convert', {
        base: converterBase,
        target: converterTarget,
        amount: Number(converterAmount)
      });
      setConversion(data);
    } catch (err) {
      setConversion(null);
      setConversionError(err.response?.data?.message || 'Could not convert this amount.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-1">
            FX INFORMATION & MODEL GUIDANCE
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900">Exchange-rate outlook</h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-gray-400 text-xs font-mono">→</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-emerald-800"
          >
            {CURRENCIES.filter(c => c !== base).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <section className="card space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Quick calculation</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
            <Calculator size={20} className="text-emerald-700" /> Currency converter
          </h2>
          <p className="mt-1 text-sm text-slate-600">Enter an amount to estimate its value using the latest available exchange-rate feed.</p>
        </div>
        <form onSubmit={convertAmount} className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto_1fr_auto] md:items-end">
          <label className="text-sm font-semibold text-slate-800">
            Amount
            <input
              aria-label="Amount to convert"
              className="input-field mt-1"
              type="number"
              min="0.01"
              step="any"
              value={converterAmount}
              onChange={(event) => setConverterAmount(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From
            <select
              className="input-field mt-1"
              value={converterBase}
              onChange={(event) => {
                const nextBase = event.target.value;
                setConverterBase(nextBase);
                if (nextBase === converterTarget) {
                  setConverterTarget(CONVERTER_CURRENCIES.find((code) => code !== nextBase));
                }
              }}
            >
              {CONVERTER_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <ArrowRightLeft className="mx-auto mb-3 hidden text-slate-400 md:block" size={18} />
          <label className="text-sm font-semibold text-slate-800">
            To
            <select
              className="input-field mt-1"
              value={converterTarget}
              onChange={(event) => setConverterTarget(event.target.value)}
            >
              {CONVERTER_CURRENCIES.filter((code) => code !== converterBase).map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={converting} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {converting ? <Loader2 size={16} className="animate-spin" /> : null}
            Convert
          </button>
        </form>
        {conversionError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{conversionError}</p>}
        {conversion && (
          <div role="status" className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div>
              <p className="text-sm text-slate-600">
                {Number(conversion.amount).toLocaleString()} {conversion.base} at {Number(conversion.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </p>
              <p className="text-2xl font-bold text-emerald-950">
                {Number(conversion.convertedAmount).toLocaleString(undefined, { maximumFractionDigits: conversion.target === 'JPY' ? 0 : 2 })} {conversion.target}
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p>{conversion.is_mock ? 'Indicative fallback rate' : conversion.source === 'LIVE_API' ? 'Live rate' : 'Cached live rate'}</p>
              <p>{conversion.timestamp ? new Date(conversion.timestamp).toLocaleString() : ''}</p>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">Indicative conversion only; provider fees, exchange-rate markups, and final delivered amounts may differ.</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FXForecastChart base={base} target={target} />
        </div>

        {/* Backtesting Accuracy Panel */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 font-mono shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Model Backtest Validation</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500">30-Day Evaluation</span>
          </div>

          {backtest ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] text-slate-500">Directional Accuracy</span>
                <span className="text-xl font-bold text-emerald-800">{backtest.metrics.directionalAccuracyPct}%</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] text-slate-500">Timing Success Rate</span>
                <span className="text-xl font-bold text-emerald-800">{backtest.metrics.timingSuccessRatePct}%</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] text-slate-500">Mean Absolute Error (MAE)</span>
                <span className="text-lg font-bold text-slate-800">{backtest.metrics.maePct}%</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] text-slate-500">Average Yield Savings</span>
                <span className="text-lg font-bold text-emerald-800">+{backtest.metrics.avgSavingsBps} bps</span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">Loading backtest data...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FXForecasting;
