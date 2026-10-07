import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  History,
  Send,
  Wallet,
  CheckCircle,
  Zap,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

const Dashboard = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [portRes, txRes] = await Promise.all([
        api.get('/portfolio'),
        api.get('/transaction/history')
      ]);

      if (portRes.data.success) {
        setPortfolio(portRes.data.data);
      }
      if (txRes.data.success) {
        setTransactions(txRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  // Compute metrics
  const totalBalanceUSD = portfolio?.totalValueUSD || 0;
  const completedCount = transactions.filter(t => t.status === 'COMPLETED' || t.status === 'COMPLETED_VIA_FALLBACK').length;
  const totalFeesPaid = transactions.reduce((acc, t) => acc + (t.railFeeUSD || 0), 0);
  const totalAiSavings = transactions.reduce((acc, t) => acc + (t.aiSavingsUSD || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-gray-800 pb-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1 font-mono">
            YOUR INDEPENDENT CROSS-BORDER TRANSFER GUIDE
          </p>
          <h1 className="text-3xl font-extrabold text-white">Understand your transfer options</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Compare estimated exchange rates, fees, and delivery times before choosing a provider. Transact3 doesn’t process payments; account balances and transfers are optional simulations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            to="/payment-router"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Send size={15} />             Compare options
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid (Section 26) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Balance */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-gray-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase font-mono tracking-wider">Demo balance</span>
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl"><DollarSign size={16} /></span>
          </div>
          <p className="text-2xl font-black text-white font-mono mt-3">
            ${totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block">Optional demo account · 9 currencies</span>
        </div>

        {/* Completed Payments */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase font-mono tracking-wider">Demo transfers</span>
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl"><CheckCircle size={16} /></span>
          </div>
          <p className="text-2xl font-black text-white font-mono mt-3">{completedCount}</p>
          <span className="text-[11px] text-gray-400 font-mono mt-1 block">Optional simulated activity</span>
        </div>

        {/* Total Fees Paid */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase font-mono tracking-wider">Demo fees</span>
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl"><TrendingUp size={16} /></span>
          </div>
          <p className="text-2xl font-black text-white font-mono mt-3">${totalFeesPaid.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 font-mono mt-1 block">Illustrative estimates only</span>
        </div>

        {/* Estimated         Illustrative savings Baseline */}
        <div className="bg-gradient-to-br from-emerald-950/40 to-gray-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-emerald-400 uppercase font-mono tracking-wider">Illustrative savings</span>
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl"><Zap size={16} /></span>
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono mt-3">${totalAiSavings.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 font-mono mt-1 block">Shown in demo history only</span>
        </div>
      </div>

      {/* Multi-Currency Holdings Section */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Wallet size={18} className="text-emerald-400" />
              Optional demo balances
            </h3>
            <p className="text-xs text-gray-400">Sample balances for trying the simulated transfer flow</p>
          </div>
          <Link
            to="/wallet"
            className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            View demo balances →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {portfolio?.holdings?.map((h) => (
            <div
              key={h.currency}
              className="bg-gray-950 p-3.5 rounded-xl border border-gray-800/80 space-y-1 hover:border-gray-700 transition-colors"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-white font-mono">{h.currency}</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  ${h.currentValueUSD?.toLocaleString()}
                </span>
              </div>
              <p className="text-lg font-black text-emerald-400 font-mono">
                {h.amount?.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <History size={18} className="text-emerald-400" />
              Recent simulated transfers
            </h3>
            <p className="text-xs text-gray-400">Optional demonstration history; no real payments are made</p>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            View demo activity →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left font-mono">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="pb-3 font-bold uppercase">Clearing Ref</th>
                <th className="pb-3 font-bold uppercase">Recipient</th>
                <th className="pb-3 font-bold uppercase">Rail</th>
                <th className="pb-3 text-right font-bold uppercase">Amount Sent</th>
                <th className="pb-3 text-right font-bold uppercase">Recipient Gets</th>
                <th className="pb-3 text-center font-bold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transactions.slice(0, 5).map((tx) => (
                <tr key={tx._id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3 text-emerald-400 font-bold">{tx.clearingReference || tx.quoteId}</td>
                  <td className="py-3 text-white">{tx.receiverEmail}</td>
                  <td className="py-3 text-gray-300">{tx.selectedRail?.replace('_', ' ')}</td>
                  <td className="py-3 text-right font-bold text-white">{tx.sourceAmount?.toLocaleString()} {tx.sourceCurrency}</td>
                  <td className="py-3 text-right font-bold text-emerald-400">~{tx.destinationAmount?.toLocaleString()} {tx.destinationCurrency}</td>
                  <td className="py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {tx.status || 'COMPLETED'}
                    </span>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No demo transfers yet. Compare options without making a transfer, or try the optional demo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
