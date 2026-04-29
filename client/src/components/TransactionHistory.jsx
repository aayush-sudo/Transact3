import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const statusConfig = {
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Approved' },
  under_review: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Under Review' },
  blocked: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Blocked' },
};

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
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ArrowUpDown size={20} className="text-fintech-primary" />
          Transaction History
        </h3>
        <span className="text-xs text-slate-500 bg-fintech-darker px-2 py-1 rounded-full">
          {transactions.length} transactions
        </span>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading history...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-700">
                <th className="text-left pb-3 font-medium">To (Email)</th>
                <th className="text-right pb-3 font-medium">Amount Sent</th>
                <th className="text-right pb-3 font-medium">Converted</th>
                <th className="text-left pb-3 pl-4 font-medium">Date (UTC)</th>
                <th className="text-center pb-3 font-medium">Status (Risk)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const status = statusConfig[tx.status] || statusConfig.blocked;
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={tx._id}
                    className="border-b border-slate-700/50 hover:bg-fintech-darker/50 transition-colors"
                  >
                    <td className="py-3 font-mono text-xs text-slate-400">
                      {tx.receiver?.email}
                    </td>
                    <td className="py-3 text-right text-white font-medium">
                      {tx.amount?.toLocaleString()}
                      <span className="text-slate-500 ml-1 text-xs">{tx.currency}</span>
                    </td>
                    <td className="py-3 text-right text-white font-medium">
                      ~{tx.convertedAmount?.toLocaleString() || '0'}
                      <span className="text-slate-500 ml-1 text-xs">{tx.receiverCurrency}</span>
                    </td>
                    <td className="py-3 pl-4 text-slate-400 text-xs">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <div
                        className={`flex flex-col items-center justify-center gap-1 ${status.bg} ${status.color} px-2 py-1 rounded-lg text-xs font-medium w-max mx-auto`}
                      >
                        <div className="flex gap-1 items-center">
                          <StatusIcon size={12} />
                          {status.label}
                        </div>
                        <span className="text-[10px] opacity-70">Risk: {tx.riskScore?.toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-slate-500 text-sm">
                    No transactions found.
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
