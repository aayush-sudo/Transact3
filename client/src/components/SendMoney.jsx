import React, { useState, useContext } from 'react';
import { Send, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import TransactionStepper from './TransactionStepper';

const SendMoney = ({ onTransactionComplete }) => {
  const { walletAddress, connectWallet } = useContext(AuthContext);
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [txResult, setTxResult] = useState(null);
  const [showApproval, setShowApproval] = useState(false);

  const generateTxHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  };

  const simulateTransaction = async () => {
    if (!receiver || !amount) return;

    // Show MetaMask-style approval popup
    setShowApproval(true);
  };

  const handleApprove = async () => {
    setShowApproval(false);
    setProcessing(true);
    setTxResult(null);

    // Step 1: Initiated
    setCurrentStep(1);
    await new Promise((r) => setTimeout(r, 1200));

    // Step 2: Validated
    setCurrentStep(2);
    await new Promise((r) => setTimeout(r, 1000));

    // Step 3: AI Decision
    setCurrentStep(3);
    await new Promise((r) => setTimeout(r, 1500));

    // Step 4: Risk Check
    setCurrentStep(4);
    await new Promise((r) => setTimeout(r, 1000));

    // Step 5: Blockchain Confirmed
    setCurrentStep(5);
    await new Promise((r) => setTimeout(r, 800));

    const txHash = generateTxHash();
    setTxResult({
      hash: txHash,
      status: 'Confirmed',
      time: '~2 sec',
      receiver,
      amount,
    });

    if (onTransactionComplete) {
      onTransactionComplete({
        hash: txHash,
        from: walletAddress || '0xMock...1234',
        to: receiver,
        amount,
        timestamp: new Date().toISOString(),
      });
    }

    setProcessing(false);
  };

  const handleReject = () => {
    setShowApproval(false);
  };

  const reset = () => {
    setReceiver('');
    setAmount('');
    setCurrentStep(0);
    setTxResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Send Money Form */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Send size={20} className="text-fintech-primary" />
          Send Money
        </h3>

        {!txResult ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Receiver Address</label>
              <input
                type="text"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="0x... or wallet address"
                className="input-field font-mono text-sm"
                disabled={processing}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Amount (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input-field"
                disabled={processing}
                min="0"
                step="0.01"
              />
            </div>
            <button
              onClick={simulateTransaction}
              disabled={processing || !receiver || !amount}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Transaction
                </>
              )}
            </button>
          </div>
        ) : (
          /* Success Result */
          <div className="space-y-3">
            <div className="flex items-center justify-center mb-2">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle size={32} className="text-green-400" />
              </div>
            </div>
            <p className="text-center text-green-400 font-semibold">Transaction Successful!</p>

            <div className="bg-fintech-darker rounded-lg p-4 space-y-2 border border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">TX Hash</span>
                <span className="text-slate-300 font-mono text-xs truncate max-w-[180px]">
                  {txResult.hash}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <span className="text-green-400 font-medium">{txResult.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Time</span>
                <span className="text-slate-300">{txResult.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="text-white font-medium">${txResult.amount}</span>
              </div>
            </div>

            <button onClick={reset} className="w-full btn-secondary mt-2">
              Send Another
            </button>
          </div>
        )}
      </div>

      {/* Transaction Stepper */}
      {(processing || currentStep > 0) && (
        <TransactionStepper currentStep={currentStep} isProcessing={processing} />
      )}

      {/* MetaMask Approval Popup Simulation */}
      {showApproval && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-fintech-card border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                  alt="MetaMask"
                  className="w-8 h-8"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <h4 className="text-lg font-bold text-white">Confirm Transaction</h4>
              <p className="text-sm text-slate-400 mt-1">MetaMask Approval</p>
            </div>

            <div className="bg-fintech-darker rounded-lg p-4 space-y-2 mb-4 border border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">To</span>
                <span className="text-slate-300 font-mono text-xs truncate max-w-[180px]">
                  {receiver}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="text-white font-bold">${amount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Gas Fee</span>
                <span className="text-slate-300">~$0.02</span>
              </div>
              <hr className="border-slate-700" />
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total</span>
                <span className="text-white font-bold">${(parseFloat(amount) + 0.02).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                className="flex-1 btn-secondary flex items-center justify-center gap-1"
              >
                <XCircle size={16} />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 btn-primary flex items-center justify-center gap-1"
              >
                <CheckCircle size={16} />
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
