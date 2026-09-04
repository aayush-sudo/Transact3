import React, { useState, useEffect } from 'react';
import { ArrowUpDown, CheckCircle } from 'lucide-react';
import api from '../services/api';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const { data } = await api.get('/transaction/history');
      if (data.success) {
        setTransactions(data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <ArrowUpDown size={16} />
          </div>
          <h3 className="text-base font-bold text-white">Settlement History</h3>
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
          {transactions.length} Records
        </span>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-gray-400 text-xs">Loading history...</p>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700/60">
                <th className="pb-2.5 font-bold uppercase">To (Recipient)</th>
                <th className="pb-2.5 font-bold uppercase">Rail</th>
                <th className="pb-2.5 text-right font-bold uppercase">Sent</th>
                <th className="pb-2.5 text-right font-bold uppercase">Received</th>
                <th className="pb-2.5 text-right font-bold uppercase">Timestamp</th>
                <th className="pb-2.5 text-center font-bold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transactions.map((tx) => (
                <tr key={tx._id || tx.quoteId} className="hover:bg-gray-700/20 transition-colors">
                  <td className="py-3 font-semibold text-white">{tx.receiverEmail || tx.receiver?.email}</td>
                  <td className="py-3 text-emerald-400 font-bold">{tx.selectedRail?.replace('_', ' ') || 'NETTING LEDGER'}</td>
                  <td className="py-3 text-right font-bold text-white">
                    {(tx.sourceAmount || tx.amount)?.toLocaleString()} <span className="text-gray-400">{tx.sourceCurrency || tx.currency}</span>
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-400">
                    ~{(tx.destinationAmount || tx.convertedAmount)?.toLocaleString()} <span className="text-gray-400">{tx.destinationCurrency || tx.receiverCurrency}</span>
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {new Date(tx.timestamp || tx.createdAt || Date.now()).toLocaleString()}
                  </td>
                  <td className="py-3 text-center">
                    {tx.status === 'SCHEDULED' ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          ⏳ IN {tx.delayHours || 2}H
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {tx.scheduledFor ? new Date(tx.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </span>
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {tx.status || 'COMPLETED'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No transactions recorded in clearing ledger yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
