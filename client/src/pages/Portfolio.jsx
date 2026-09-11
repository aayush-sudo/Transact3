import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Plus,
  DollarSign,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Send,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';

const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' }
];

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form state
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('2000');

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
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
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid deposit amount');
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post('/portfolio/holdings', {
        currency,
        amount: numAmount
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message || `Deposited ${numAmount} ${currency} into wallet`);
        setShowAdd(false);
        setAmount('1000');
        await fetchPortfolio();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to deposit funds');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-gray-800 pb-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1 font-mono">
            MULTI-CURRENCY BALANCES & TREASURY
          </p>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Wallet className="text-emerald-400" size={28} />
            Multi-Currency Wallet
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPortfolio}
            className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 text-xs font-mono transition-colors"
            title="Refresh Holdings"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setShowAdd(true); setSuccessMsg(null); setErrorMsg(null); }}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Simulated Funds
          </button>
          <Link
            to="/payment-router"
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs font-mono flex items-center gap-2 border border-gray-700 transition-all"
          >
            <Send size={14} className="text-emerald-400" /> Send Funds
          </Link>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center gap-2.5 font-mono animate-fadeIn">
          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2.5 font-mono animate-fadeIn">
          <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary Banner */}
      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1 font-mono">
              Total Consolidated Treasury Value
            </p>
            <p className="text-3xl font-black text-white font-mono flex items-center gap-1">
              <DollarSign size={26} className="text-emerald-400" />
              {portfolio?.totalValueUSD?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} USD
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Reconciled across 9 active fiat currencies with double-entry clearing records.
            </p>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold flex items-center gap-2"
          >
            <Plus size={14} /> Quick Deposit
          </button>
        </div>
      </div>

      {/* Holdings Cards Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white font-mono">Currency Balances (9 Supported Currencies)</h3>
          <span className="text-xs text-gray-400 font-mono">Real-Time Holdings</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolio?.holdings?.map((h) => (
            <div
              key={h.currency}
              className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 space-y-3 hover:border-gray-700 transition-colors shadow-lg"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-lg font-black text-white font-mono">{h.currency}</span>
                  <span className="text-[11px] text-gray-400 block font-sans">
                    {SUPPORTED_CURRENCIES.find(c => c.code === h.currency)?.name || h.currency}
                  </span>
                </div>
                <span className="text-xs font-mono bg-gray-950 px-2.5 py-1 rounded-lg text-gray-400 border border-gray-800">
                  ≈ ${h.currentValueUSD?.toLocaleString()} USD
                </span>
              </div>

              <div className="border-t border-gray-800/80 pt-2 flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-mono block">Available Balance</span>
                  <p className="text-xl font-black text-emerald-400 font-mono">
                    {h.amount?.toLocaleString()} {h.currency}
                  </p>
                </div>
                <button
                  onClick={() => { setCurrency(h.currency); setShowAdd(true); }}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-mono transition-colors"
                  title={`Deposit ${h.currency}`}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Simulated Funds Modal (Section 6) */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest block">Simulated Wallet Deposit</span>
                <h3 className="text-base font-black text-white">Add Simulated Funds</h3>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              Deposits are simulated. A double-entry ledger record (<code className="text-emerald-400 font-mono">DEPOSIT / CREDIT</code>) will be created to maintain full financial auditability.
            </p>

            <form onSubmit={handleAddHolding} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="text-gray-300 font-bold uppercase block">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-gray-300 font-bold uppercase block">Deposit Amount</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="2000"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="w-1/2 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-gray-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;
