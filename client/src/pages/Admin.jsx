import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Ban, Eye, Filter } from 'lucide-react';

const mockAdminData = [
  { id: 'TX001', user: 'Alice Johnson', email: 'alice@email.com', amount: 500, risk: 12, status: 'approved', country: 'US → UK', date: '2026-04-26' },
  { id: 'TX002', user: 'Bob Smith', email: 'bob@email.com', amount: 15000, risk: 87, status: 'blocked', country: 'US → RU', date: '2026-04-26' },
  { id: 'TX003', user: 'Carlos Mendes', email: 'carlos@email.com', amount: 3200, risk: 45, status: 'approved', country: 'BR → US', date: '2026-04-25' },
  { id: 'TX004', user: 'Diana Lee', email: 'diana@email.com', amount: 8900, risk: 72, status: 'flagged', country: 'CN → SG', date: '2026-04-25' },
  { id: 'TX005', user: 'Ethan Brown', email: 'ethan@email.com', amount: 250, risk: 8, status: 'approved', country: 'US → CA', date: '2026-04-25' },
  { id: 'TX006', user: 'Fatima Al-Hassan', email: 'fatima@email.com', amount: 25000, risk: 92, status: 'blocked', country: 'AE → NG', date: '2026-04-24' },
  { id: 'TX007', user: 'George Kim', email: 'george@email.com', amount: 1800, risk: 35, status: 'approved', country: 'KR → JP', date: '2026-04-24' },
  { id: 'TX008', user: 'Hannah Patel', email: 'hannah@email.com', amount: 6700, risk: 61, status: 'flagged', country: 'IN → US', date: '2026-04-24' },
  { id: 'TX009', user: 'Ivan Petrov', email: 'ivan@email.com', amount: 42000, risk: 95, status: 'blocked', country: 'RU → CH', date: '2026-04-23' },
  { id: 'TX010', user: 'Julia Santos', email: 'julia@email.com', amount: 150, risk: 5, status: 'approved', country: 'BR → US', date: '2026-04-23' },
];

const statusConfig = {
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  flagged: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  blocked: { icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const Admin = () => {
  const [filter, setFilter] = useState('all');

  const filteredData =
    filter === 'all'
      ? mockAdminData
      : mockAdminData.filter((d) => d.status === filter);

  const stats = {
    total: mockAdminData.length,
    approved: mockAdminData.filter((d) => d.status === 'approved').length,
    flagged: mockAdminData.filter((d) => d.status === 'flagged').length,
    blocked: mockAdminData.filter((d) => d.status === 'blocked').length,
    totalVolume: mockAdminData.reduce((acc, d) => acc + d.amount, 0),
  };

  const getRiskColor = (risk) => {
    if (risk <= 33) return 'text-green-400';
    if (risk <= 66) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskBg = (risk) => {
    if (risk <= 33) return 'bg-green-400';
    if (risk <= 66) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <Shield size={28} className="text-fintech-accent" />
            Admin Panel
          </h1>
          <p className="text-slate-400">Transaction monitoring & risk oversight</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card !p-4">
          <p className="text-xs text-slate-500 mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-slate-500 mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-white">${stats.totalVolume.toLocaleString()}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-green-400 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-yellow-400 mb-1">Flagged</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.flagged}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-red-400 mb-1">Blocked</p>
          <p className="text-2xl font-bold text-red-400">{stats.blocked}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'approved', 'flagged', 'blocked'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              filter === f
                ? 'bg-fintech-primary text-white'
                : 'bg-fintech-card text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            {f === 'all' ? `All (${stats.total})` : `${f} (${stats[f]})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-700">
              <th className="text-left pb-3 font-medium">User</th>
              <th className="text-left pb-3 font-medium">Route</th>
              <th className="text-right pb-3 font-medium">Amount</th>
              <th className="text-center pb-3 font-medium">Risk Score</th>
              <th className="text-center pb-3 font-medium">Status</th>
              <th className="text-left pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((tx) => {
              const status = statusConfig[tx.status];
              const StatusIcon = status.icon;
              return (
                <tr
                  key={tx.id}
                  className={`border-b border-slate-700/50 transition-colors ${
                    tx.status === 'blocked'
                      ? 'bg-red-500/5 hover:bg-red-500/10'
                      : tx.status === 'flagged'
                      ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                      : 'hover:bg-fintech-darker/50'
                  }`}
                >
                  <td className="py-3">
                    <div>
                      <p className="text-white font-medium">{tx.user}</p>
                      <p className="text-xs text-slate-500">{tx.email}</p>
                    </div>
                  </td>
                  <td className="py-3 text-slate-400 text-xs font-medium">{tx.country}</td>
                  <td className="py-3 text-right text-white font-semibold">
                    ${tx.amount.toLocaleString()}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${getRiskBg(tx.risk)}`}
                          style={{ width: `${tx.risk}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${getRiskColor(tx.risk)}`}>
                        {tx.risk}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div
                      className={`flex items-center justify-center gap-1 ${status.bg} ${status.color} px-2.5 py-1 rounded-full text-xs font-medium w-fit mx-auto border ${status.border}`}
                    >
                      <StatusIcon size={12} />
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </div>
                  </td>
                  <td className="py-3 text-slate-400 text-xs">{tx.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Admin;
