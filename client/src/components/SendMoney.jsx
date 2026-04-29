import React, { useState } from 'react';
import { Send, CheckCircle, XCircle, Loader } from 'lucide-react';
import { ethers } from 'ethers';
import api from '../services/api';
import TransactionStepper from './TransactionStepper';

const SendMoney = ({ onTransactionComplete }) => {
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [receiverCurrency, setReceiverCurrency] = useState('EUR');

  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showApproval, setShowApproval] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [error, setError] = useState(null);

  const initiateTransaction = async () => {
    if (!receiver || !amount) return;
    setShowApproval(true);
  };

  const handleApprove = async () => {
    setShowApproval(false);
    setProcessing(true);
    setError(null);
    setTxResult(null);

    try {
      setCurrentStep(1);

      let txHash = '0xMockTxHash1234567890abcdef';
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const tx = await signer.sendTransaction({
          to: address,
          value: ethers.utils.parseEther("0.0001")
        });
        txHash = tx.hash;
        await tx.wait();
      }

      setCurrentStep(2);
      await new Promise((r) => setTimeout(r, 500));

      setCurrentStep(3);
      const { data } = await api.post('/transaction/send', {
        receiverEmail: receiver,
        amount: Number(amount),
        currency,
        receiverCurrency,
        txHash,
      });

      setCurrentStep(4);
      await new Promise((r) => setTimeout(r, 500));

      setCurrentStep(5);
      await new Promise((r) => setTimeout(r, 500));

      if (data.success) {
        setTxResult({ ...data.data, txHash });
        if (onTransactionComplete) {
          onTransactionComplete({ ...data.data, txHash });
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Transaction failed');
      setCurrentStep(0);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = () => {
    setShowApproval(false);
  };

  const reset = () => {
    setReceiver('');
    setAmount('');
    setCurrentStep(0);
    setTxResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4 max-w-md w-full">
      <div className="card">
        <h3 className="text-base font-bold text-velto-ink mb-4 flex items-center gap-2">
          <div className="p-1.5 bg-velto-forest rounded-lg">
            <Send size={15} className="text-velto-lime" />
          </div>
          Send Money
        </h3>

        {!txResult ? (
          <div className="space-y-3">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                {error}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-velto-muted uppercase tracking-wider block mb-1.5">Receiver Email</label>
              <input
                type="email"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="bob@example.com"
                className="input-field text-sm w-full"
                disabled={processing}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-velto-muted uppercase tracking-wider block mb-1.5">Amount</label>
              <div className="flex bg-velto-surface rounded-xl border border-velto-surface-dark overflow-hidden">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent text-velto-ink px-3 py-2.5 outline-none w-full border-none m-0 focus:ring-0 text-sm font-semibold"
                  disabled={processing}
                  min="0"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-velto-muted border-none px-2 outline-none cursor-pointer text-sm font-semibold"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-velto-muted uppercase tracking-wider block mb-1.5">Convert To</label>
              <select
                value={receiverCurrency}
                onChange={(e) => setReceiverCurrency(e.target.value)}
                className="input-field w-full text-sm"
                disabled={processing}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <button
              onClick={initiateTransaction}
              disabled={processing || !receiver || !amount}
              className="w-full btn-lime flex items-center justify-center gap-2 mt-2 disabled:opacity-40"
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
              <div className="w-12 h-12 bg-velto-lime rounded-full flex items-center justify-center">
                <CheckCircle size={28} className="text-velto-forest" />
              </div>
            </div>
            <p className="text-center text-velto-forest font-bold mb-4">Transaction Initialized</p>

            <div className="bg-velto-surface rounded-xl p-4 space-y-3 border border-velto-surface-dark">
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">Status</span>
                <span className="text-velto-ink font-semibold">{txResult.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">Risk Score</span>
                <span className="text-velto-ink font-mono">{txResult.riskScore?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">Amount Sent</span>
                <span className="text-velto-ink font-semibold">
                  {txResult.amount?.toLocaleString()} {txResult.currency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">Exchange Rate</span>
                <span className="text-velto-ink font-mono text-xs">1 {txResult.currency} = {txResult.exchangeRate} {txResult.receiverCurrency}</span>
              </div>
              <div className="flex justify-between text-sm items-center pt-2 border-t border-velto-surface-dark">
                <span className="text-velto-muted font-medium">Converted Amount</span>
                <span className="text-velto-forest font-bold text-base">
                  ~{txResult.convertedAmount?.toLocaleString()} {txResult.receiverCurrency}
                </span>
              </div>
              {txResult.txHash && (
                <div className="flex justify-between text-sm items-center pt-2 border-t border-velto-surface-dark">
                  <span className="text-velto-muted font-medium">Blockchain Tx</span>
                  <a href={`https://polygonscan.com/tx/${txResult.txHash}`} target="_blank" rel="noreferrer" className="text-velto-forest font-mono text-xs hover:underline">
                    {txResult.txHash.slice(0, 8)}...{txResult.txHash.slice(-6)}
                  </a>
                </div>
              )}
            </div>

            <button onClick={reset} className="w-full btn-secondary mt-2 text-sm">
              Send Another
            </button>
          </div>
        )}
      </div>

      {/* Transaction Stepper */}
      {(processing || currentStep > 0) && !txResult && (
        <TransactionStepper currentStep={currentStep} isProcessing={processing} />
      )}

      {/* Approval Modal */}
      {showApproval && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-velto-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-velto-surface rounded-full flex items-center justify-center mx-auto mb-3">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                  alt="MetaMask"
                  className="w-8 h-8"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <h4 className="text-lg font-bold text-velto-ink">Confirm Transaction</h4>
              <p className="text-sm text-velto-muted mt-1">Transaction Approval</p>
            </div>

            <div className="bg-velto-surface rounded-xl p-4 space-y-2 mb-5 border border-velto-surface-dark">
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">To Email</span>
                <span className="text-velto-ink font-mono text-xs truncate max-w-[180px]">{receiver}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">Amount</span>
                <span className="text-velto-ink font-bold">{amount} {currency}</span>
              </div>
              <hr className="border-velto-surface-dark" />
              <div className="flex justify-between text-sm">
                <span className="text-velto-muted font-medium">Conversion</span>
                <span className="text-velto-ink">To {receiverCurrency}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                className="flex-1 btn-secondary flex items-center justify-center gap-1 text-sm"
              >
                <XCircle size={15} />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 btn-lime flex items-center justify-center gap-1 text-sm"
              >
                <CheckCircle size={15} />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendMoney;
