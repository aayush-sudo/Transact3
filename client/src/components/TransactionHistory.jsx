import React from 'react';
import { ArrowUpDown, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const mockTransactions = [
  { id: 'TX001', from: '0xa1b2...c3d4', to: '0xe5f6...g7h8', amount: 500, currency: 'USD', date: '2026-04-26 10:15', status: 'completed' },
  { id: 'TX002', from: '0xi9j0...k1l2', to: '0xm3n4...o5p6', amount: 1200, currency: 'USD', date: '2026-04-25 14:30', status: 'completed' },
  { id: 'TX003', from: '0xq7r8...s9t0', to: '0xu1v2...w3x4', amount: 75, currency: 'EUR', date: '2026-04-25 09:45', status: 'pending' },
  { id: 'TX004', from: '0xy5z6...a7b8', to: '0xc9d0...e1f2', amount: 3500, currency: 'USD', date: '2026-04-24 16:22', status: 'completed' },
  { id: 'TX005', from: '0xg3h4...i5j6', to: '0xk7l8...m9n0', amount: 890, currency: 'GBP', date: '2026-04-24 11:10', status: 'failed' },
  { id: 'TX006', from: '0xo1p2...q3r4', to: '0xs5t6...u7v8', amount: 250, currency: 'USD', date: '2026-04-23 08:55', status: 'completed' },
];

const statusConfig = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Completed' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
};

const TransactionHistory = () => {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ArrowUpDown size={20} className="text-fintech-primary" />
          Transaction History
        </h3>
        <span className="text-xs text-slate-500 bg-fintech-darker px-2 py-1 rounded-full">
          {mockTransactions.length} transactions
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-700">
              <th className="text-left pb-3 font-medium">ID</th>
              <th className="text-left pb-3 font-medium">From → To</th>
              <th className="text-right pb-3 font-medium">Amount</th>
              <th className="text-left pb-3 font-medium">Date</th>
              <th className="text-center pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockTransactions.map((tx) => {
              const status = statusConfig[tx.status];
              const StatusIcon = status.icon;
              return (
                <tr
                  key={tx.id}
                  className="border-b border-slate-700/50 hover:bg-fintech-darker/50 transition-colors"
                >
                  <td className="py-3 text-slate-300 font-mono text-xs">{tx.id}</td>
                  <td className="py-3 font-mono text-xs text-slate-400">
                    {tx.from} → {tx.to}
                  </td>
                  <td className="py-3 text-right text-white font-medium">
                    ${tx.amount.toLocaleString()}
                    <span className="text-slate-500 ml-1 text-xs">{tx.currency}</span>
                  </td>
                  <td className="py-3 text-slate-400 text-xs">{tx.date}</td>
                  <td className="py-3">
                    <div
                      className={`flex items-center justify-center gap-1 ${status.bg} ${status.color} px-2 py-1 rounded-full text-xs font-medium w-fit mx-auto`}
                    >
                      <StatusIcon size={12} />
                      {status.label}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionHistory;
