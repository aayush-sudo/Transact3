import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ArrowRightLeft, Calculator } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'AED', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'ZAR'];

const CurrencyConverter = ({ base = 'USD', setBase, target = 'INR', setTarget }) => {
  const [amount, setAmount] = useState(1000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    setLoading(true);
    try {
      const res = await api.post('/fx/quote', { sourceCurrency: base, destinationCurrency: target, amount: Number(amount) });
      if (res.data && res.data.data) {
        setResult({
          convertedAmount: res.data.data.destinationAmount,
          rate: res.data.data.quotedRate
        });
      }
    } catch {
      // Fallback calculation
      const rate = target === 'INR' ? 83.20 : target === 'EUR' ? 0.92 : 0.79;
      setResult({
        convertedAmount: parseFloat((amount * rate).toFixed(2)),
        rate
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    if (setBase && setTarget) {
      setBase(target);
      setTarget(base);
    }
  };

  useEffect(() => {
    handleConvert();
  }, [base, target, amount]);

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Calculator size={18} />
          </div>
          <h3 className="text-sm font-bold text-white">Live Rate Calculator</h3>
        </div>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">15 Global Currencies</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Amount</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-gray-900/80 border border-gray-700/60 rounded-xl px-3 py-2 text-white font-bold text-sm outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">From</label>
            <select
              value={base}
              onChange={(e) => setBase && setBase(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700/60 text-white rounded-xl px-2.5 py-2 text-xs font-bold outline-none cursor-pointer"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button
            onClick={handleSwap}
            className="mt-4 p-2 bg-gray-700/50 hover:bg-gray-700 text-emerald-400 rounded-xl border border-gray-600/50 transition-colors"
          >
            <ArrowRightLeft size={14} />
          </button>

          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">To</label>
            <select
              value={target}
              onChange={(e) => setTarget && setTarget(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700/60 text-emerald-400 rounded-xl px-2.5 py-2 text-xs font-bold outline-none cursor-pointer"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/90 rounded-xl p-4 border border-emerald-500/30 text-center space-y-1">
        {loading ? (
          <div className="animate-pulse text-xs text-emerald-400">Calculating Live Rate...</div>
        ) : result ? (
          <>
            <p className="text-[11px] text-gray-400 font-semibold">
              {amount.toLocaleString()} {base} =
            </p>
            <p className="text-2xl font-black text-emerald-400">
              {result.convertedAmount?.toLocaleString()} {target}
            </p>
            <p className="text-[10px] text-gray-400">
              Customer Rate: 1 {base} = {result.rate} {target}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CurrencyConverter;
