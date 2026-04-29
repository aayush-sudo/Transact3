import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ArrowRightLeft } from 'lucide-react';

const CurrencyConverter = ({ base, setBase, target, setTarget }) => {
  const [amount, setAmount] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'];

  const handleConvert = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/currency/convert', { base, target, amount });
      setResult(res.data);
    } catch (err) {
      setError('Failed to convert currency');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setBase(target);
    setTarget(base);
  };

  useEffect(() => {
    handleConvert();
    const interval = setInterval(() => {
      handleConvert();
    }, 60000);
    return () => clearInterval(interval);
  }, [base, target, amount]);

  return (
    <div className="card">
      <h3 className="text-base font-bold text-velto-ink mb-5">Currency Converter</h3>

      {error && <div className="text-red-500 mb-3 text-sm">{error}</div>}

      <div className="flex flex-col gap-3 mb-5">
        <div>
          <label className="block text-xs font-semibold text-velto-muted uppercase tracking-wider mb-1.5">Amount</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input-field text-lg font-semibold"
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-velto-muted uppercase tracking-wider mb-1.5">From</label>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="input-field font-semibold appearance-none"
            >
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button
            onClick={handleSwap}
            className="mb-0.5 p-2.5 rounded-xl bg-velto-surface hover:bg-velto-surface-dark transition-colors border border-velto-surface-dark text-velto-forest flex-shrink-0"
          >
            <ArrowRightLeft size={16} />
          </button>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-velto-muted uppercase tracking-wider mb-1.5">To</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="input-field font-semibold appearance-none"
            >
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-velto-forest rounded-2xl p-5 flex flex-col items-center justify-center">
        {loading && !result ? (
          <div className="animate-pulse h-8 w-40 bg-velto-forest-mid rounded" />
        ) : result ? (
          <>
            <p className="text-velto-lime/60 text-sm mb-1">
              {amount} {base} =
            </p>
            <p className="text-4xl font-bold text-velto-lime">
              {result.convertedAmount} {target}
            </p>
            {Number(amount) !== 1 && (
              <p className="text-xs text-velto-lime/50 mt-2">
                1 {base} = {result.rate} {target}
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CurrencyConverter;
