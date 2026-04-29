import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Ban } from 'lucide-react';

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
  approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  flagged:  { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  blocked:  { icon: Ban, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
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
    if (risk <= 33) return { text: 'text-green-600', bar: 'bg-green-400' };
    if (risk <= 66) return { text: 'text-amber-600', bar: 'bg-amber-400' };
    return { text: 'text-red-600', bar: 'bg-red-400' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-widest text-velto-muted uppercase mb-1">RISK OVERSIGHT</p>
        <h1 className="text-3xl font-bold text-velto-ink flex items-center gap-3">
          <div className="p-2 bg-velto-forest rounded-xl">
            <Shield size={22} className="text-velto-lime" />
          </div>
          Admin Panel
        </h1>
        <p className="text-velto-muted mt-1">Transaction monitoring & risk oversight</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card !p-4">
          <p className="text-xs font-bold text-velto-faint uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-bold text-velto-ink">{stats.total}</p>
        </div>
        <div className="bg-velto-forest rounded-2xl p-4">
          <p className="text-xs font-bold text-velto-lime/60 uppercase tracking-wider mb-1">Volume</p>
          <p className="text-2xl font-bold text-white">${stats.totalVolume.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
          <p className="text-xs font-bold text-green-500 uppercase tracking-wider mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Flagged</p>
          <p className="text-2xl font-bold text-amber-600">{stats.flagged}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Blocked</p>
          <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'approved', 'flagged', 'blocked'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
              filter === f
                ? 'bg-velto-forest text-velto-lime'
                : 'bg-white text-velto-muted hover:text-velto-ink border border-velto-surface hover:bg-velto-surface'
            }`}
          >
            {f === 'all' ? `All (${stats.total})` : `${f} (${stats[f]})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-velto-faint border-b border-velto-surface bg-velto-surface">
              <th className="text-left py-3 px-4 font-bold uppercase tracking-wider">User</th>
              <th className="text-left py-3 px-4 font-bold uppercase tracking-wider">Route</th>
              <th className="text-right py-3 px-4 font-bold uppercase tracking-wider">Amount</th>
              <th className="text-center py-3 px-4 font-bold uppercase tracking-wider">Risk Score</th>
              <th className="text-center py-3 px-4 font-bold uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 font-bold uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((tx) => {
              const status = statusConfig[tx.status];
              const StatusIcon = status.icon;
              const risk = getRiskColor(tx.risk);
              return (
                <tr
                  key={tx.id}
                  className={`border-b border-velto-surface transition-colors ${
                    tx.status === 'blocked'
                      ? 'bg-red-50/50 hover:bg-red-50'
                      : tx.status === 'flagged'
                      ? 'bg-amber-50/50 hover:bg-amber-50'
                      : 'hover:bg-velto-surface/40'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-velto-ink font-semibold">{tx.user}</p>
                      <p className="text-xs text-velto-faint">{tx.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-velto-muted text-xs font-semibold">{tx.country}</td>
                  <td className="py-3 px-4 text-right text-velto-ink font-bold">
                    ${tx.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-velto-surface-dark rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${risk.bar}`}
                          style={{ width: `${tx.risk}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${risk.text}`}>{tx.risk}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`flex items-center justify-center gap-1 ${status.bg} ${status.color} px-2.5 py-1 rounded-full text-xs font-semibold w-fit mx-auto border ${status.border}`}
                    >
                      <StatusIcon size={11} />
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-velto-faint text-xs font-medium">{tx.date}</td>
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
