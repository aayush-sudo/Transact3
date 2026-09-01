import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import api from '../services/api';
import FXQuoteCard from './FXQuoteCard';
import FXTimingBadge from './FXTimingBadge';
import RailRanking from './RailRanking';
import TransactionTimeline from './TransactionTimeline';
import TCAAnalytics from './TCAAnalytics';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'AED', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'ZAR'];

const MultiRailRouter = ({ onTransactionComplete }) => {
  const [sourceCurrency, setSourceCurrency] = useState('USD');
  const [destinationCurrency, setDestinationCurrency] = useState('EUR');
  const [amount, setAmount] = useState('10000');
  const [receiverEmail, setReceiverEmail] = useState('recipient@transact3.io');
  const [priority, setPriority] = useState('BALANCED');

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [orchestration, setOrchestration] = useState(null);
  const [selectedRailId, setSelectedRailId] = useState(null);

  const [executing, setExecuting] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGetQuote = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoadingQuote(true);
    setError(null);
    setTxResult(null);

    try {
      const { data } = await api.post('/fx/quote', {
        sourceCurrency,
        destinationCurrency,
        amount: Number(amount),
        priority
      });

      if (data.success) {
        setQuoteData(data.data);
        setOrchestration(data.orchestration);
        if (data.orchestration && data.orchestration.recommendedRail) {
          setSelectedRailId(data.orchestration.recommendedRail.id);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch payment quote');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!quoteData || !receiverEmail) return;
    setExecuting(true);
    setError(null);

    try {
      const { data } = await api.post('/transaction/send', {
        quoteId: quoteData.quoteId,
        receiverEmail,
        sourceCurrency,
        destinationCurrency,
        amount: Number(amount),
        priority,
        idempotencyKey: `PAY-${Date.now()}`
      });

      if (data.success) {
        setTxResult(data.data);
        if (onTransactionComplete) {
          onTransactionComplete(data.data);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Transaction settlement failed');
    } finally {
      setExecuting(false);
    }
  };

  const resetForm = () => {
    setQuoteData(null);
    setOrchestration(null);
    setTxResult(null);
    setError(null);
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-gray-700/60 shadow-2xl space-y-5">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Multi-Rail Cross-Border Payment Orchestrator</h3>
            <p className="text-xs text-gray-400">Jointly optimizes cost, speed, liquidity capacity, and FX conversion timing</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl">
          {error}
        </div>
      )}

      {!txResult ? (
        <div className="space-y-4">
          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">You Send</label>
              <div className="flex bg-gray-900/80 rounded-xl border border-gray-700/60 overflow-hidden">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  className="bg-transparent text-white px-3 py-2.5 outline-none w-full text-sm font-mono font-bold"
                />
                <select
                  value={sourceCurrency}
                  onChange={(e) => setSourceCurrency(e.target.value)}
                  className="bg-gray-800 text-emerald-400 border-none px-2 outline-none cursor-pointer text-sm font-bold font-mono"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Recipient Currency</label>
              <select
                value={destinationCurrency}
                onChange={(e) => setDestinationCurrency(e.target.value)}
                className="w-full bg-gray-900/80 border border-gray-700/60 text-white rounded-xl px-3 py-2.5 outline-none text-sm font-bold font-mono cursor-pointer"
              >
                {CURRENCIES.filter(c => c !== sourceCurrency).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Recipient Email</label>
              <input
                type="email"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
                placeholder="recipient@transact3.io"
                className="w-full bg-gray-900/80 border border-gray-700/60 text-white rounded-xl px-3 py-2.5 outline-none text-sm font-mono"
              />
            </div>
          </div>

          {/* Policy Priority Profile Selector */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">AI Routing Priority Profile</label>
            <div className="grid grid-cols-3 gap-2">
              {['BALANCED', 'COST', 'SPEED'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl text-xs font-bold font-mono border transition-all ${
                    priority === p
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-gray-900/40 border-gray-700/40 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {p === 'BALANCED' ? 'Balanced AI Optimal' : p === 'COST' ? 'Minimize Cost' : 'Maximize Speed'}
                </button>
              ))}
            </div>
          </div>

          {/* Get Quote Action */}
          <button
            onClick={handleGetQuote}
            disabled={loadingQuote || !amount}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingQuote ? (
              <><Loader2 size={18} className="animate-spin" /> Computing AI Joint Optimization...</>
            ) : (
              <><RefreshCw size={18} /> Generate AI Payment Quote</>
            )}
          </button>

          {/* Quote Analysis Output */}
          {quoteData && orchestration && (
            <div className="space-y-4 pt-3 border-t border-gray-700/60 animate-fadeIn">
              <FXTimingBadge timing={orchestration.fxTiming} />
              <FXQuoteCard quote={quoteData} onExpire={handleGetQuote} />
              <RailRanking
                rails={orchestration.evaluatedRails}
                selectedRailId={selectedRailId}
                onSelectRail={(id) => setSelectedRailId(id)}
              />

              <button
                onClick={handleExecutePayment}
                disabled={executing}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-gray-950 font-black rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 text-base"
              >
                {executing ? (
                  <><Loader2 size={20} className="animate-spin" /> Executing 11-Stage Settlement...</>
                ) : (
                  <><Send size={20} /> Authorize & Execute Payment</>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Completed Transaction Receipt */
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/40">
              <CheckCircle size={32} />
            </div>
          </div>
          <div className="text-center">
            <h4 className="text-lg font-bold text-white">Cross-Border Payment Settled</h4>
            <p className="text-xs text-gray-400 font-mono mt-0.5">Clearing Ref: {txResult.clearingReference}</p>
          </div>

          <TransactionTimeline currentStatus={txResult.transaction?.status || 'COMPLETED'} />
          <TCAAnalytics tca={txResult.tca} aiSavingsUSD={txResult.transaction?.aiSavingsUSD || 0} />

          <button onClick={resetForm} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all text-sm">
            Initiate Another Payment
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiRailRouter;
