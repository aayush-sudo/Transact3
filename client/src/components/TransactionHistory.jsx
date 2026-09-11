import React, { useState, useEffect } from 'react';
import { ArrowUpDown, CheckCircle, ShieldCheck, FileText, ChevronRight, X, Loader2, Info } from 'lucide-react';
import api from '../services/api';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchTransactions = async () => {
    try {
      const { data } = await api.get('/transaction/history');
      if (data.success) {
        setTransactions(data.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenDetails = async (tx) => {
    setSelectedTx(tx);
    setLoadingDetails(true);
    try {
      const { data } = await api.get(`/transaction/${tx._id}`);
      if (data.success) {
        setTxDetails(data.data);
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-md rounded-2xl p-6 border border-gray-800 shadow-xl space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <ArrowUpDown size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cross-Border Settlement History</h3>
            <p className="text-[11px] text-gray-400">Click any transaction to inspect double-entry ledger & audit logs</p>
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-950 px-3 py-1 rounded-full border border-gray-800">
          {transactions.length} Records
        </span>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="pb-3 font-bold uppercase">Transaction ID</th>
                <th className="pb-3 font-bold uppercase">Recipient</th>
                <th className="pb-3 font-bold uppercase">Rail</th>
                <th className="pb-3 text-right font-bold uppercase">Amount</th>
                <th className="pb-3 text-right font-bold uppercase">FX Rate</th>
                <th className="pb-3 text-right font-bold uppercase">Fee</th>
                <th className="pb-3 text-center font-bold uppercase">Status</th>
                <th className="pb-3 text-center font-bold uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {transactions.map((tx) => (
                <tr
                  key={tx._id}
                  onClick={() => handleOpenDetails(tx)}
                  className="hover:bg-gray-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 font-bold text-emerald-400">
                    {tx.clearingReference || tx.quoteId || tx._id.substring(0, 10)}
                  </td>
                  <td className="py-3 text-white">
                    {tx.receiverEmail || tx.recipient?.email}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-200">{tx.selectedRail?.replace('_', ' ')}</span>
                      {tx.selectionMode === 'MANUAL_OVERRIDE' && (
                        <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          OVERRIDE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right text-white font-bold">
                    {tx.sourceAmount?.toLocaleString()} {tx.sourceCurrency}
                    <span className="text-gray-500 block text-[10px]">
                      → ~{tx.destinationAmount?.toLocaleString()} {tx.destinationCurrency}
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-300">
                    {tx.executedFXRate || tx.quotedFXRate}
                  </td>
                  <td className="py-3 text-right text-gray-300">
                    ${tx.railFeeUSD?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-3 text-center">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {tx.status || 'COMPLETED'}
                    </span>
                  </td>
                  <td className="py-3 text-center text-gray-400 group-hover:text-white">
                    <ChevronRight size={16} className="inline-block" />
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No transactions recorded in clearing ledger yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Transaction Details Drawer / Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 font-mono max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest block">Settlement Audit Drawer</span>
                <h3 className="text-lg font-black text-white">Transaction: {selectedTx.clearingReference || selectedTx.quoteId}</h3>
              </div>
              <button
                onClick={() => { setSelectedTx(null); setTxDetails(null); }}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Basic Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Sender</span>
                    <span className="text-white font-bold">{selectedTx.sender?.email || 'Alice'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Recipient</span>
                    <span className="text-white font-bold">{selectedTx.receiverEmail}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Total Sender Debit</span>
                    <span className="text-emerald-400 font-bold">${selectedTx.totalSenderDebitUSD?.toFixed(2) || (selectedTx.sourceAmount + selectedTx.railFeeUSD).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Selection Mode</span>
                    <span className="text-white">{selectedTx.selectionMode || 'RECOMMENDED'}</span>
                  </div>
                </div>

                {/* Double-Entry Ledger Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-400" />
                    Double-Entry Clearing Ledger Records ({txDetails?.ledgerEntries?.length || 0})
                  </h4>
                  <div className="bg-gray-950 rounded-xl border border-gray-800 p-2 max-h-48 overflow-y-auto divide-y divide-gray-800/80">
                    {txDetails?.ledgerEntries?.map((entry, idx) => (
                      <div key={idx} className="py-2 px-2 flex justify-between items-center text-[11px]">
                        <div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-2 ${
                            entry.entryType === 'DEPOSIT' ? 'bg-blue-500/20 text-blue-300' :
                            entry.entryType === 'PAYMENT_DEBIT' ? 'bg-amber-500/20 text-amber-300' :
                            entry.entryType === 'FEE' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {entry.entryType} ({entry.direction})
                          </span>
                          <span className="text-gray-300">{entry.description}</span>
                        </div>
                        <span className={`font-bold font-mono ${entry.direction === 'DEBIT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {entry.direction === 'DEBIT' ? '-' : '+'}{entry.amount} {entry.currency}
                        </span>
                      </div>
                    ))}
                    {(!txDetails?.ledgerEntries || txDetails.ledgerEntries.length === 0) && (
                      <p className="text-gray-500 text-center py-4">No ledger records found for this transaction</p>
                    )}
                  </div>
                </div>

                {/* Tamper-Evident SHA-256 Audit Log Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Tamper-Evident Cryptographic Audit Chain
                  </h4>
                  <div className="bg-gray-950 rounded-xl border border-gray-800 p-3 space-y-2 text-[10px]">
                    {txDetails?.auditLogs?.map((log, idx) => (
                      <div key={idx} className="border-b border-gray-800/60 pb-2 last:border-b-0 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-400 font-bold">{log.action}</span>
                          <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-gray-400 break-all"><span className="text-gray-600">Prev Hash:</span> {log.previousHash}</p>
                        <p className="text-gray-300 break-all"><span className="text-gray-600">Block Hash:</span> {log.currentHash}</p>
                      </div>
                    ))}
                    {(!txDetails?.auditLogs || txDetails.auditLogs.length === 0) && (
                      <p className="text-gray-500 text-center py-2">No audit blocks recorded for this transaction</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
