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
      // Step 1: Initiated
      setCurrentStep(1);
      
      let txHash = '0xMockTxHash1234567890abcdef';
      // Trigger Web3 MetaMask Transaction
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        // Send a nominal transaction or value based on amount
        const tx = await signer.sendTransaction({
          to: address, // sending to self to demonstrate flow
          value: ethers.utils.parseEther("0.0001") // Mock small amount
        });
        txHash = tx.hash;
        await tx.wait();
      }

      // Step 2: Validated
      setCurrentStep(2);
      await new Promise((r) => setTimeout(r, 500));

      // Step 3: AI Decision (Backend API Call)
      setCurrentStep(3);
      const { data } = await api.post('/transaction/send', {
        receiverEmail: receiver,
        amount: Number(amount),
        currency,
        receiverCurrency,
        txHash, // Save the actual web3 transaction hash
      });

      // Step 4: Risk Check
      setCurrentStep(4);
      await new Promise((r) => setTimeout(r, 500));

      // Step 5: Confirmed
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
              onClick={initiateTransaction}
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
              {txResult.txHash && (
                <div className="flex justify-between text-sm items-center mt-2 border-t border-slate-700/50 pt-2">
                  <span className="text-slate-400">Blockchain Tx</span>
                  <a href={`https://polygonscan.com/tx/${txResult.txHash}`} target="_blank" rel="noreferrer" className="text-fintech-primary font-mono text-xs hover:underline">
                    {txResult.txHash.slice(0, 8)}...{txResult.txHash.slice(-6)}
                  </a>
                </div>
              )}
            </div>

            <button onClick={reset} className="w-full btn-secondary mt-2">
              Send Another
            </button>
          </div>
        )}
      </div>

      {/* Transaction Stepper Component */}
      {(processing || currentStep > 0) && !txResult && (
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
              <p className="text-sm text-slate-400 mt-1">Transaction Approval</p>
            </div>

            <div className="bg-fintech-darker rounded-lg p-4 space-y-2 mb-4 border border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">To Email</span>
                <span className="text-slate-300 font-mono text-xs truncate max-w-[180px]">
                  {receiver}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="text-white font-bold">{amount} {currency}</span>
              </div>
              <hr className="border-slate-700" />
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Conversion</span>
                <span className="text-slate-300">To {receiverCurrency}</span>
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
