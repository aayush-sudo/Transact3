import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle, Loader2, Sparkles, Clock, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
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

  // Timing & Scheduling state
  const [timingMode, setTimingMode] = useState('IMMEDIATE'); // 'IMMEDIATE' | 'SCHEDULED'
  const [delayHours, setDelayHours] = useState(2);
  const [fastForwarding, setFastForwarding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

        // Check if AI timing suggests deferring for optimal window
        if (data.orchestration?.fxTiming?.recommendation?.startsWith('DEFER') || data.orchestration?.fxTiming?.deferHours > 0) {
          setTimingMode('SCHEDULED');
          setDelayHours(data.orchestration.fxTiming.deferHours || 2);
        } else {
          setTimingMode('IMMEDIATE');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch payment quote');
    } finally {
      setLoadingQuote(false);
    }
  };

  const [showIsoPayload, setShowIsoPayload] = useState(false);

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
        selectedRail: selectedRailId || quoteData.selectedRail,
        selectedRailId: selectedRailId || quoteData.selectedRail,
        executionMode: timingMode,
        delayHours: timingMode === 'SCHEDULED' ? delayHours : 0,
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

  const handleFastForwardNow = async () => {
    const txId = txResult?.transaction?._id;
    if (!txId) return;
    setFastForwarding(true);
    try {
      const { data } = await api.post(`/transaction/${txId}/execute-now`);
      if (data.success) {
        setTxResult(prev => ({
          ...prev,
          transaction: data.data.transaction,
          executionMode: 'IMMEDIATE',
          settledAt: data.data.settledAt,
          iso20022: data.data.iso20022,
          blockchainReceipt: data.data.blockchainReceipt
        }));
        if (onTransactionComplete) onTransactionComplete(data.data);
      }
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.message || 'Failed to execute payment immediately');
    } finally {
      setFastForwarding(false);
    }
  };

  const handleCancelScheduled = async () => {
    const txId = txResult?.transaction?._id;
    if (!txId) return;
    setCancelling(true);
    try {
      await api.post(`/transaction/${txId}/cancel`);
      resetForm();
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.message || 'Failed to cancel scheduled transaction');
    } finally {
      setCancelling(false);
    }
  };

  const resetForm = () => {
    setQuoteData(null);
    setOrchestration(null);
    setTxResult(null);
    setError(null);
    setShowIsoPayload(false);
    setTimingMode('IMMEDIATE');
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

              {/* Execution Schedule & Timing Selector */}
              <div className="bg-gray-900/60 p-3.5 rounded-xl border border-gray-700/60 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} className="text-emerald-400" /> Execution Schedule & Timing Mode
                  </span>
                  {timingMode === 'SCHEDULED' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                      Est. Savings: +${((quoteData.sourceAmount * 0.0038 * (delayHours / 2))).toFixed(2)} USD
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTimingMode('IMMEDIATE')}
                    className={`p-2.5 rounded-xl border font-bold transition-all text-left ${
                      timingMode === 'IMMEDIATE'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                        : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-sans font-bold text-xs">
                      <Zap size={14} className="text-amber-400" /> Execute Immediately
                    </div>
                    <p className="text-[10px] text-gray-400 font-normal mt-0.5">Settle now at current quoted rate</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTimingMode('SCHEDULED')}
                    className={`p-2.5 rounded-xl border font-bold transition-all text-left ${
                      timingMode === 'SCHEDULED'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                        : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-sans font-bold text-xs">
                      <TrendingUp size={14} className="text-emerald-400" /> Schedule for Optimal Window
                    </div>
                    <p className="text-[10px] text-gray-400 font-normal mt-0.5">Wait 2-3h to capture predicted rate dip</p>
                  </button>
                </div>

                {timingMode === 'SCHEDULED' && (
                  <div className="pt-2 border-t border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Execution Delay:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 6, 12, 24].map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setDelayHours(h)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                              delayHours === h
                                ? 'bg-emerald-500 text-gray-950 shadow'
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            +{h}h
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Scheduled execution target: <strong className="text-emerald-300 font-bold">{new Date(Date.now() + delayHours * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> (in {delayHours} hours)
                    </p>
                  </div>
                )}
              </div>

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
                  <><Loader2 size={20} className="animate-spin" /> {timingMode === 'SCHEDULED' ? 'Scheduling Payment...' : 'Executing 11-Stage Settlement...'}</>
                ) : (
                  timingMode === 'SCHEDULED' ? (
                    <><Clock size={20} /> Authorize & Schedule Payment (+{delayHours}h Optimal Window)</>
                  ) : (
                    <><Send size={20} /> Authorize & Execute Payment Immediately</>
                  )
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Transaction Result View (SCHEDULED or COMPLETED) */
        txResult.executionMode === 'SCHEDULED' || txResult.transaction?.status === 'SCHEDULED' ? (
          /* Scheduled Transaction View */
          <div className="space-y-4 animate-fadeIn font-mono">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center border border-amber-500/40">
                <Clock size={32} />
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-bold text-white">Payment Scheduled & Queued in Pipeline</h4>
              <p className="text-xs text-emerald-400 font-mono mt-0.5">
                Target Execution: {new Date(txResult.scheduledFor || txResult.transaction?.scheduledFor).toLocaleDateString()} at {new Date(txResult.scheduledFor || txResult.transaction?.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Clearing Ref: {txResult.clearingReference}</p>
            </div>

            <TransactionTimeline currentStatus="SCHEDULED" scheduledFor={txResult.scheduledFor || txResult.transaction?.scheduledFor} />

            <div className="bg-gray-900/80 border border-emerald-500/30 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between items-center text-white">
                <span>Selected Pipeline:</span>
                <span className="text-emerald-400 font-bold">{txResult.transaction?.selectedRail?.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span>Scheduled Execution Delay:</span>
                <span className="text-amber-300 font-bold">+{txResult.delayHours || delayHours} Hours (Optimal Window)</span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span>Forecasted Timing Savings:</span>
                <span className="text-emerald-400 font-bold">+${txResult.expectedYieldSavingsUSD || txResult.transaction?.expectedYieldSavingsUSD || 0} USD</span>
              </div>
              <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-800">
                The automated background scheduler (fxCronService) will automatically execute this payment when the optimal target window arrives.
              </p>
            </div>

            <TCAAnalytics tca={txResult.tca} aiSavingsUSD={txResult.transaction?.aiSavingsUSD || 0} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleFastForwardNow}
                disabled={fastForwarding}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2"
              >
                {fastForwarding ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Execute Immediately Now (Skip Delay)
              </button>
              <button
                onClick={handleCancelScheduled}
                disabled={cancelling}
                className="w-full py-3 bg-gray-800 hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 border border-gray-700 hover:border-rose-500/40 font-bold rounded-xl transition-all text-xs"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Scheduled Payment'}
              </button>
            </div>

            <button onClick={resetForm} className="w-full py-2.5 bg-gray-700/60 hover:bg-gray-700 text-gray-300 rounded-xl transition-all text-xs">
              Initiate Another Payment
            </button>
          </div>
        ) : (
          /* Completed Immediate Transaction Receipt */
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/40">
                <CheckCircle size={32} />
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-bold text-white">Cross-Border Payment Settled</h4>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Clearing Ref: {txResult.clearingReference}</p>
              {txResult.transaction?.estimatedLatencyHours > 1 && (
                <p className="text-[11px] text-amber-300 font-mono mt-1">
                  Broadcasting on {txResult.transaction?.selectedRail?.replace('_', ' ')} · Est. Clearance: ~{txResult.transaction?.estimatedLatencyHours}h
                </p>
              )}
            </div>

            <TransactionTimeline currentStatus={txResult.transaction?.status || 'COMPLETED'} />
            <TCAAnalytics tca={txResult.tca} aiSavingsUSD={txResult.transaction?.aiSavingsUSD || 0} />

            {/* Web3 Blockchain Receipt Banner (if available) */}
            {txResult.blockchainReceipt && (
              <div className="bg-gray-900/80 border border-emerald-500/30 rounded-xl p-4 font-mono text-xs space-y-1.5">
                <div className="flex justify-between items-center text-emerald-400 font-bold">
                  <span>Web3 Liquidity Vault Receipt</span>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">Polygon / Ethereum PoS</span>
                </div>
                <p className="text-gray-300 text-[11px] break-all">
                  <span className="text-gray-500">Tx Hash:</span> {txResult.blockchainReceipt.txHash}
                </p>
                <div className="flex gap-4 text-[10px] text-gray-400">
                  <span>Block #{txResult.blockchainReceipt.blockNumber}</span>
                  <span>Gas: {txResult.blockchainReceipt.gasUsed}</span>
                  <span>Vault: USDC/EURC CCTP Pool</span>
                </div>
              </div>
            )}

            {/* ISO 20022 Expandable Payload */}
            <div className="bg-gray-900/60 border border-gray-700/60 rounded-xl overflow-hidden font-mono text-xs">
              <button
                onClick={() => setShowIsoPayload(!showIsoPayload)}
                className="w-full px-4 py-2.5 bg-gray-800/80 hover:bg-gray-800 text-left flex justify-between items-center text-gray-300 font-bold"
              >
                <span>ISO 20022 pacs.008.001.08 Financial Message Payload</span>
                <span className="text-emerald-400 text-xs">{showIsoPayload ? '▲ Collapse' : '▼ View Payload'}</span>
              </button>
              {showIsoPayload && (
                <div className="p-4 bg-gray-950 text-[11px] text-emerald-400 overflow-x-auto max-h-60 overflow-y-auto">
                  <pre>{JSON.stringify(txResult.iso20022?.pacs008 || txResult.transaction?.iso20022Message || {}, null, 2)}</pre>
                </div>
              )}
            </div>

            <button onClick={resetForm} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all text-sm font-mono">
              Initiate Another Payment
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default MultiRailRouter;
