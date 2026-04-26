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
    // Auto-refresh rates every 60 seconds
    const interval = setInterval(() => {
      handleConvert();
    }, 60000);
    return () => clearInterval(interval);
  }, [base, target, amount]);

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-white mb-6">Currency Converter</h3>
      
      {error && <div className="text-red-400 mb-4 text-sm">{error}</div>}
      
      <div className="flex flex-col md:flex-row gap-4 items-center mb-6">
        <div className="w-full">
          <label className="block text-sm text-slate-400 mb-2">Amount</label>
          <input 
            type="number" 
            min="0"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input-field text-xl font-medium"
          />
        </div>
        
        <div className="w-full">
          <label className="block text-sm text-slate-400 mb-2">From</label>
          <select 
            value={base} 
            onChange={(e) => setBase(e.target.value)}
            className="input-field text-xl font-medium appearance-none"
          >
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <button 
          onClick={handleSwap}
          className="mt-6 p-3 rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors mx-2 flex-shrink-0"
        >
          <ArrowRightLeft size={20} />
        </button>
        
        <div className="w-full">
          <label className="block text-sm text-slate-400 mb-2">To</label>
          <select 
            value={target} 
            onChange={(e) => setTarget(e.target.value)}
            className="input-field text-xl font-medium appearance-none"
          >
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-6 flex flex-col items-center justify-center border border-slate-700/50">
        {loading && !result ? (
          <div className="animate-pulse h-10 w-48 bg-slate-700 rounded"></div>
        ) : result ? (
          <>
            <p className="text-slate-400 text-lg mb-1">
              {amount} {base} =
            </p>
            <p className="text-4xl font-bold text-fintech-primary">
              {result.convertedAmount} {target}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              1 {base} = {result.rate} {target}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CurrencyConverter;
