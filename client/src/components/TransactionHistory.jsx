import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const statusConfig = {
  approved:     { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Approved' },
  under_review: { icon: Clock,        color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200',  label: 'Under Review' },
  blocked:      { icon: XCircle,      color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200',    label: 'Blocked' },
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
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-velto-ink flex items-center gap-2">
          <div className="p-1.5 bg-velto-forest rounded-lg">
            <ArrowUpDown size={15} className="text-velto-lime" />
          </div>
          Transaction History
        </h3>
        <span className="text-xs font-bold text-velto-muted bg-velto-surface px-3 py-1 rounded-full border border-velto-surface-dark">
          {transactions.length} transactions
        </span>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-velto-faint text-sm">Loading history...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-velto-faint border-b border-velto-surface-dark">
                <th className="text-left pb-3 font-semibold uppercase tracking-wider">To (Email)</th>
                <th className="text-right pb-3 font-semibold uppercase tracking-wider">Amount Sent</th>
                <th className="text-right pb-3 font-semibold uppercase tracking-wider">Converted</th>
                <th className="text-left pb-3 pl-4 font-semibold uppercase tracking-wider">Date (UTC)</th>
                <th className="text-center pb-3 font-semibold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const status = statusConfig[tx.status] || statusConfig.blocked;
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={tx._id}
                    className="border-b border-velto-surface hover:bg-velto-surface/60 transition-colors"
                  >
                    <td className="py-3 font-mono text-xs text-velto-muted">
                      {tx.receiver?.email}
                    </td>
                    <td className="py-3 text-right text-velto-ink font-semibold">
                      {tx.amount?.toLocaleString()}
                      <span className="text-velto-faint ml-1 text-xs">{tx.currency}</span>
                    </td>
                    <td className="py-3 text-right text-velto-ink font-semibold">
                      ~{tx.convertedAmount?.toLocaleString() || '0'}
                      <span className="text-velto-faint ml-1 text-xs">{tx.receiverCurrency}</span>
                    </td>
                    <td className="py-3 pl-4 text-velto-faint text-xs">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <div
                        className={`flex flex-col items-center justify-center gap-0.5 ${status.bg} ${status.color} px-2.5 py-1.5 rounded-xl text-xs font-semibold w-max mx-auto border ${status.border}`}
                      >
                        <div className="flex gap-1 items-center">
                          <StatusIcon size={11} />
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
                  <td colSpan="5" className="text-center py-8 text-velto-faint text-sm">
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
