import React, { useState } from 'react';
import { Send, CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../services/api';

const SendMoney = ({ onTransactionComplete }) => {
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [receiverCurrency, setReceiverCurrency] = useState('EUR');
  const [processing, setProcessing] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (!receiver || !amount) return;
    setProcessing(true);
    setError(null);
    setTxResult(null);

    try {
      const { data } = await api.post('/transaction/send', {
        receiverEmail: receiver,
        amount: Number(amount),
        currency,
        receiverCurrency,
      });

      if (data.success) {
        setTxResult(data.data);
        if (onTransactionComplete) {
          onTransactionComplete(data.data);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Transaction failed');
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setReceiver('');
    setAmount('');
    setTxResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4 max-w-md w-full">
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Send size={20} className="text-fintech-primary" />
          Send Money
        </h3>

        {!txResult ? (
          <div className="space-y-3">
            {error && (
              <div className="p-2 text-sm text-red-500 bg-red-500/10 rounded-md">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm text-slate-400 block mb-1">Receiver Email</label>
              <input
                type="email"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="bob@example.com"
                className="input-field text-sm w-full"
                disabled={processing}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm text-slate-400 block mb-1">Amount</label>
                <div className="flex bg-fintech-darker rounded-lg border border-slate-700/50">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-white px-3 py-2 outline-none w-full border-none m-0 focus:ring-0"
                    disabled={processing}
                    min="0"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-transparent text-slate-300 border-none px-2 outline-none cursor-pointer"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Convert To</label>
              <select
                value={receiverCurrency}
                onChange={(e) => setReceiverCurrency(e.target.value)}
                className="input-field w-full"
                disabled={processing}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <button
              onClick={handleSend}
              disabled={processing || !receiver || !amount}
              className="w-full btn-primary flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {processing ? (
                <><Loader size={16} className="animate-spin" /> Processing...</>
              ) : (
                <><Send size={16} /> Send Transaction</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center mb-2">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            <p className="text-center text-green-400 font-semibold mb-4">Transaction Initialized</p>

            <div className="bg-fintech-darker rounded-lg p-4 space-y-3 border border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <span className="text-white font-medium">{txResult.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Risk Score</span>
                <span className="text-white font-mono">{txResult.riskScore?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount Sent</span>
                <span className="text-white font-medium">
                  {txResult.amount?.toLocaleString()} {txResult.currency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Exchange Rate</span>
                <span className="text-slate-300 font-mono">1 {txResult.currency} = {txResult.exchangeRate} {txResult.receiverCurrency}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-400">Converted Amount</span>
                <span className="text-green-400 font-bold text-base">
                  ~{txResult.convertedAmount?.toLocaleString()} {txResult.receiverCurrency}
                </span>
              </div>
            </div>

            <button onClick={reset} className="w-full btn-secondary mt-2">
              Send Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendMoney;
