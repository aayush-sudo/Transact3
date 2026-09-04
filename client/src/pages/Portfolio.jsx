import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, TrendingUp, TrendingDown, DollarSign, Wallet, ShieldCheck, ArrowUpRight, RefreshCw, Loader2 } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'AED', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'ZAR'];

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('1.0');

  const fetchPortfolio = async () => {
    try {
      const res = await api.get('/portfolio');
      if (res.data.success) {
        setPortfolio(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleAddHolding = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await api.post('/portfolio', {
        currency,
        amount: Number(amount),
        averageBuyPrice: Number(price) || 1.0
      });
      setShowAdd(false);
      setAmount('');
      await fetchPortfolio();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
        <p className="text-gray-400 text-xs font-mono">Loading Multi-Currency Portfolio...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
            TREASURY LIQUIDITY & MULTI-CURRENCY ASSETS
          </p>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Wallet className="text-emerald-400" size={28} />
            Corporate Portfolio & Vaults
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPortfolio}
            className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 text-xs font-mono transition-colors"
            title="Refresh Holdings"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus size={16} /> Deposit / Add Asset
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-950/80 to-gray-900 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8 blur-xl" />
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1 font-mono">Total Treasury Value</p>
          <p className="text-3xl font-black text-white flex items-center gap-1 font-mono">
            <DollarSign size={26} className="text-emerald-400" />
            {portfolio?.totalValueUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            <span className="text-xs text-gray-400 font-sans font-normal ml-1">USD Eq.</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-2 font-mono">Real-time mid-market benchmark valuation</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/60 rounded-2xl p-6 shadow-xl">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">Active Currency Vaults</p>
          <p className="text-3xl font-black text-white font-mono">
            {portfolio?.holdings?.length || 0}
            <span className="text-xs text-emerald-400 font-sans font-normal ml-2">Currencies</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-2 font-mono">Global settlement liquidity accounts</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/60 rounded-2xl p-6 shadow-xl">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">Vault Protection</p>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck size={26} className="text-emerald-400" />
            <span className="text-lg font-bold text-white font-mono">Institutional 100% Reserve</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-mono">Real-time double-entry clearing ledger</p>
        </div>
      </div>

      {/* Add Holding Form */}
      {showAdd && (
        <div className="bg-gray-800/90 border border-emerald-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
            <Plus size={16} className="text-emerald-400" /> Add Funds or Holding to Treasury Vault
          </h3>
          <form onSubmit={handleAddHolding} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 font-mono">Currency</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none cursor-pointer"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 font-mono">Amount</label>
              <input
                type="number"
                required
                placeholder="50000"
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-xs font-mono outline-none"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 font-mono">Cost Basis (vs USD)</label>
              <input
                type="number"
                step="0.0001"
                required
                placeholder="1.0"
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-xs font-mono outline-none"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-xs font-mono shadow-md flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Holding'}
            </button>
          </form>
        </div>
      )}

      {/* Holdings Table */}
      <div className="bg-gray-800/80 border border-gray-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-700/60 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Multi-Currency Balance Sheet</h3>
          <span className="text-[11px] text-gray-400 font-mono">Auto-reconciled with clearing accounts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-gray-900/60 text-gray-400 border-b border-gray-700/60">
                <th className="p-4 font-bold uppercase tracking-wider">Currency Asset</th>
                <th className="p-4 font-bold uppercase tracking-wider">Vault Balance</th>
                <th className="p-4 font-bold uppercase tracking-wider">Avg Acquisition Price</th>
                <th className="p-4 font-bold uppercase tracking-wider">Current Value (USD)</th>
                <th className="p-4 font-bold uppercase tracking-wider">Floating P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {portfolio?.holdings?.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    No holdings in portfolio yet. Click "Deposit / Add Asset" above.
                  </td>
                </tr>
              ) : (
                portfolio?.holdings?.map((item) => (
                  <tr key={item._id || item.currency} className="hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-bold text-emerald-400 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400">
                        {item.currency.substring(0, 2)}
                      </div>
                      {item.currency}
                    </td>
                    <td className="p-4 text-white font-bold">
                      {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-gray-400">
                      ${item.averageBuyPrice?.toFixed(4)}
                    </td>
                    <td className="p-4 text-white font-semibold">
                      ${item.currentValueUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${item.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.profitLoss >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        ${Math.abs(item.profitLoss || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
