import React, { useState, useEffect } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle,
  Loader2,
  Sparkles,
  Clock,
  Zap,
  Activity,
  Repeat,
  CreditCard,
  Globe,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  ChevronDown,
  Info,
  Check,
  FileText,
  ShieldAlert,
  Copy,
  Layers
} from 'lucide-react';
import api from '../services/api';
import TransactionSimulationModal from './TransactionSimulationModal';
import TCAAnalytics from './TCAAnalytics';

const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' }
];

const ICON_MAP = {
  Activity,
  Repeat,
  Zap,
  CreditCard,
  Globe
};

const MultiRailRouter = ({ onTransactionComplete }) => {
  // Input State
  const [paymentMode, setPaymentMode] = useState('SEND_AMOUNT'); // 'SEND_AMOUNT' | 'RECIPIENT_GETS'
  const [sourceCurrency, setSourceCurrency] = useState('USD');
  const [destinationCurrency, setDestinationCurrency] = useState('INR');
  const [amount, setAmount] = useState('1000');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [priority, setPriority] = useState('BALANCED'); // 'BALANCED' | 'CHEAPEST' | 'FASTEST'

  // Analysis & Quote State
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [orchestration, setOrchestration] = useState(null);
  const [selectedRailId, setSelectedRailId] = useState(null);
  const [selectionMode, setSelectionMode] = useState('RECOMMENDED');

  // Confirmation & Execution State
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [error, setError] = useState(null);
  const [overrideWarning, setOverrideWarning] = useState(null);

  // RegTech AML & Graph Routing State
  const [amlCompliance, setAmlCompliance] = useState(null);
  const [graphRoute, setGraphRoute] = useState(null);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [copiedXml, setCopiedXml] = useState(false);
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);

  // 16-Step Interactive Simulation Modal
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  // Fetch recipients on mount
  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        const { data } = await api.get('/user/recipients');
        if (data.success && data.data && data.data.length > 0) {
          setRecipients(data.data);
          setReceiverEmail(data.data[0].email);
        }
      } catch (err) {
        console.warn('Could not fetch recipients:', err.message);
      }
    };
    fetchRecipients();
  }, []);

  const handleAnalyzePayment = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid transfer amount');
      return;
    }
    if (!receiverEmail) {
      setError('Please select or specify a recipient');
      return;
    }

    setLoadingQuote(true);
    setError(null);
    setTxResult(null);
    setShowConfirmScreen(false);
    setOverrideWarning(null);
    setComplianceAcknowledged(false);

    try {
      const { data } = await api.post('/transaction/quote', {
        sourceCurrency,
        destinationCurrency,
        amount: Number(amount),
        paymentMode,
        priority,
        receiverEmail
      });

      if (data.success) {
        setQuoteData(data.data.quote);
        setOrchestration(data.data.orchestration);
        setAmlCompliance(data.data.amlCompliance);
        setGraphRoute(data.data.graphRoute);

        const recRail = data.data.orchestration?.recommendedRail;
        if (recRail) {
          setSelectedRailId(recRail.id);
          setSelectionMode('RECOMMENDED');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to analyze payment routing');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleSelectRail = (rail) => {
    setOverrideWarning(null);
    if (!rail.is_eligible) {
      setOverrideWarning(`${rail.name} cannot be selected: ${rail.rejection_reason}`);
      return;
    }

    setSelectedRailId(rail.id);
    if (orchestration && orchestration.recommendedRail && rail.id === orchestration.recommendedRail.id) {
      setSelectionMode('RECOMMENDED');
    } else {
      setSelectionMode('MANUAL_OVERRIDE');
    }
  };

  const handleExecutePayment = async () => {
    if (!quoteData) return;
    setExecuting(true);
    setError(null);

    try {
      const { data } = await api.post('/transaction/confirm', {
        quoteId: quoteData.quoteId,
        selectedRail: selectedRailId || quoteData.selectedRail,
        idempotencyKey: `PAY-${quoteData.quoteId}-${Date.now()}`
      });

      if (data.success) {
        setTxResult(data.data);
        setShowConfirmScreen(false);
        if (onTransactionComplete) {
          onTransactionComplete(data.data);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Transaction execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const selectedRailObject = orchestration?.evaluatedRails?.find(r => r.id === selectedRailId) || orchestration?.recommendedRail;

  return (
    <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 font-mono">
              Dynamic Multi-Rail Payment Orchestration
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Cross-Border Payment Router</h2>
        </div>

        {/* Payment Mode Selector Tabs */}
        <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => { setPaymentMode('SEND_AMOUNT'); setQuoteData(null); }}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              paymentMode === 'SEND_AMOUNT'
                ? 'bg-emerald-500 text-gray-950 shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Mode A: Send Amount
          </button>
          <button
            type="button"
            onClick={() => { setPaymentMode('RECIPIENT_GETS'); setQuoteData(null); }}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              paymentMode === 'RECIPIENT_GETS'
                ? 'bg-emerald-500 text-gray-950 shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Mode B: Recipient Gets
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2.5 font-mono">
          <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recipient Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
            Recipient User
          </label>
          <div className="relative">
            <select
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono appearance-none"
            >
              {recipients.map((r) => (
                <option key={r._id} value={r.email}>
                  {r.name} ({r.email})
                </option>
              ))}
              {recipients.length === 0 && (
                <option value="bob@transact3.com">Bob Smith (bob@transact3.com)</option>
              )}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Source Currency & Destination Currency */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
            Currency Corridor
          </label>
          <div className="flex items-center gap-2">
            <select
              value={sourceCurrency}
              onChange={(e) => setSourceCurrency(e.target.value)}
              className="w-1/2 bg-gray-950 border border-gray-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
            <ArrowRight size={14} className="text-emerald-400 flex-shrink-0" />
            <select
              value={destinationCurrency}
              onChange={(e) => setDestinationCurrency(e.target.value)}
              className="w-1/2 bg-gray-950 border border-gray-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount Input with Mode indicator */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono flex justify-between">
            <span>{paymentMode === 'SEND_AMOUNT' ? 'Amount to Send' : 'Recipient Must Get'}</span>
            <span className="text-emerald-400">{paymentMode === 'SEND_AMOUNT' ? sourceCurrency : destinationCurrency}</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Routing Preference Policy Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-950/60 p-3.5 rounded-xl border border-gray-800">
        <div>
          <span className="text-xs font-bold text-gray-300 font-mono block">Routing Optimization Preference</span>
          <span className="text-[11px] text-gray-500">Determines algorithm weight distribution across cost, latency, and reliability</span>
        </div>
        <div className="flex gap-2">
          {['BALANCED', 'CHEAPEST', 'FASTEST'].map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => setPriority(pref)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                priority === pref
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {pref}
            </button>
          ))}
        </div>
      </div>

      {/* Analyze Route Action Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAnalyzePayment}
          disabled={loadingQuote}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-gray-950 font-bold rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
        >
          {loadingQuote ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Analyze Payment Route
        </button>
      </div>

      {/* Analysis Results Display */}
      {orchestration && (
        <div className="space-y-6 pt-4 border-t border-gray-800 animate-fadeIn">
          {/* FX Engine Analysis Card */}
          {orchestration.fxAnalysis && (
            <div className="bg-gradient-to-r from-gray-950 to-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-800/60 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono">Advanced FX Engine Analysis</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono border ${
                  orchestration.fxAnalysis.classification === 'EXECUTE_NOW'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : orchestration.fxAnalysis.classification === 'CONSIDER_DEFER'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}>
                  Guidance: {orchestration.fxAnalysis.classification}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Current Rate</span>
                  <span className="text-emerald-400 font-bold">1 {sourceCurrency} = {orchestration.fxAnalysis.currentRate} {destinationCurrency}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">24h SMA</span>
                  <span className="text-gray-300">{orchestration.fxAnalysis.sma24h}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">24h EMA</span>
                  <span className="text-gray-300">{orchestration.fxAnalysis.ema24h}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Volatility</span>
                  <span className="text-gray-300">{orchestration.fxAnalysis.volatility}% ({orchestration.fxAnalysis.volatilityClassification})</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2.5 font-sans leading-relaxed">
                💡 <span className="font-semibold text-gray-300">Analytical Guidance:</span> {orchestration.fxAnalysis.recommendation}
              </p>
            </div>
          )}

          {/* RegTech AML Compliance & Dijkstra Graph Route Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. RegTech AML & Sanction Clearance Card */}
            {amlCompliance && (
              <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3.5 space-y-2 font-mono">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    {amlCompliance.decision === 'PASS' ? (
                      <ShieldCheck size={16} className="text-emerald-400" />
                    ) : (
                      <ShieldAlert size={16} className="text-amber-400" />
                    )}
                    <span className="text-xs font-bold text-white">RegTech AML / Sanction Screening</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    amlCompliance.decision === 'PASS'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : amlCompliance.decision === 'MANUAL_REVIEW'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {amlCompliance.decision}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Screened Entity</span>
                    <span className="text-gray-200 truncate block font-sans">{amlCompliance.query_name || receiverEmail}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Sanction Risk Score</span>
                    <span className={`font-bold ${amlCompliance.risk_score < 0.65 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {Math.round(amlCompliance.risk_score * 100)}% ({amlCompliance.matched_target ? `Nearest: ${amlCompliance.matched_target}` : 'No Match'})
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 border-t border-gray-800/60 pt-1.5 flex justify-between">
                  <span>Algorithms: Jaro-Winkler · Levenshtein · Soundex</span>
                  <span className="text-emerald-400 font-bold">OFAC / UN Cleared</span>
                </div>
              </div>
            )}

            {/* 2. Dijkstra Multi-Hop FX Graph Route Card */}
            {graphRoute && (
              <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3.5 space-y-2 font-mono">
                <div className="flex justify-between items-center border-b border-gray-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-indigo-400" />
                    <span className="text-xs font-bold text-white">Dijkstra Multi-Hop FX Route</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {graphRoute.is_multi_hop ? `${graphRoute.hop_count} Hops (Bridge)` : 'Direct Single Hop'}
                  </span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-xs font-bold text-emerald-400">Path:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {graphRoute.path?.map((node, i) => (
                      <React.Fragment key={node}>
                        <span className="px-2 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-white font-bold">
                          {node}
                        </span>
                        {i < graphRoute.path.length - 1 && (
                          <ArrowRight size={12} className="text-indigo-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] border-t border-gray-800/60 pt-1.5">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Effective Rate</span>
                    <span className="text-white font-bold">{graphRoute.effective_rate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Net Conversion Fee</span>
                    <span className="text-gray-300">{graphRoute.net_fee_bps} bps ({graphRoute.net_fee_percentage}%)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Path Latency</span>
                    <span className="text-indigo-300">~{graphRoute.estimated_latency_seconds}s</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4-Rail Comparison Matrix */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">4 Settlement Rails Comparison</h3>
                <p className="text-[11px] text-gray-400">Click any eligible rail to manually override recommendation</p>
              </div>
              {selectionMode === 'MANUAL_OVERRIDE' && (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  MANUAL OVERRIDE ACTIVE
                </span>
              )}
            </div>

            {overrideWarning && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-xl flex items-center gap-2 font-mono">
                <AlertTriangle size={15} />
                <span>{overrideWarning}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5">
              {orchestration.evaluatedRails?.map((rail, index) => {
                const isSelected = selectedRailId === rail.id;
                const isRecommended = orchestration.recommendedRail && orchestration.recommendedRail.id === rail.id;
                const Icon = ICON_MAP[rail.icon] || Globe;

                return (
                  <div
                    key={rail.id}
                    onClick={() => handleSelectRail(rail)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      !rail.is_eligible
                        ? 'bg-gray-950/40 border-gray-800/60 opacity-60 hover:border-rose-500/40'
                        : isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/30'
                        : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          !rail.is_eligible ? 'bg-gray-800 text-gray-500' : isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-300'
                        }`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{rail.name}</span>
                            {isRecommended && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-gray-950 font-mono">
                                RECOMMENDED
                              </span>
                            )}
                            {!rail.is_eligible && (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                                NOT ELIGIBLE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Fee: ${rail.est_fee_usd?.toFixed(2)} (Fixed: ${rail.fixed_fee_usd} + Var: ${rail.variable_fee_usd}) · Settlement: {rail.expected_settlement_display || `${rail.est_latency_hours}h`}
                          </p>
                          {!rail.is_eligible && (
                            <p className="text-[11px] text-rose-400 font-mono mt-1">
                              Reason: {rail.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col justify-between sm:text-right items-end">
                        <div className="text-xs font-bold font-mono">
                          {rail.is_eligible ? (
                            <span className="text-emerald-400">Score: {rail.final_score?.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-500">Excluded</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Reliability: {Math.round((rail.reliability_score || 0.99) * 100)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanation Banner */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-gray-300 font-sans">
              <span className="font-bold text-emerald-400 font-mono">Routing Decision: </span>
              {orchestration.explanation}
            </div>
          </div>

          {/* Action Row: Review & Confirmation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowSimulationModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 border border-gray-700 transition-all cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              Interactive 16-Step Simulation
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmScreen(true)}
              className="w-full sm:w-auto px-7 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <CheckCircle size={15} />
              Review & Confirm Payment
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Screen Drawer / Modal (Section 16) */}
      {showConfirmScreen && quoteData && selectedRailObject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 font-mono">
            <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest block">Payment Execution Confirmation</span>
                <h3 className="text-lg font-black text-white">Confirm Cross-Border Settlement</h3>
              </div>
              <button
                onClick={() => setShowConfirmScreen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Recipient</span>
                <span className="text-white font-bold">{quoteData.receiverEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Source Transfer Amount</span>
                <span className="text-white font-bold">{quoteData.sourceAmount} {quoteData.sourceCurrency}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Recipient Receives</span>
                <span className="text-emerald-400 font-bold">~{quoteData.destinationAmount} {quoteData.destinationCurrency}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Locked FX Rate</span>
                <span className="text-gray-300">1 {quoteData.sourceCurrency} = {quoteData.quotedRate} {quoteData.destinationCurrency}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Selected Settlement Rail</span>
                <span className="text-white font-bold">{selectedRailObject.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Selection Mode</span>
                <span className={`font-bold ${selectionMode === 'RECOMMENDED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectionMode}
                </span>
              </div>

              {/* Granular TCA Cost Breakdown */}
              <div className="bg-gray-950/70 p-2.5 rounded-xl border border-gray-800 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Route Clearing Fee:</span>
                  <span className="text-white font-bold">${selectedRailObject.est_fee_usd?.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">FX Spread Cost ({quoteData.spreadBps || 30} bps):</span>
                  <span className="text-amber-400 font-bold">${(quoteData.fxCostUSD || 0).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between border-t border-gray-800/80 pt-1">
                  <span className="text-gray-300 font-semibold">Total Estimated Cost:</span>
                  <span className="text-emerald-400 font-bold">${((selectedRailObject.est_fee_usd || 0) + (quoteData.fxCostUSD || 0)).toFixed(2)} USD</span>
                </div>
                {quoteData.aiSavingsUSD > 0 && (
                  <div className="flex justify-between text-emerald-400 text-[10px] font-bold">
                    <span>SWIFT Benchmark Savings:</span>
                    <span>+${quoteData.aiSavingsUSD.toFixed(2)} USD</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Expected Settlement Duration</span>
                <span className="text-emerald-400">
                  {selectedRailObject.id?.startsWith('SWIFT')
                    ? '~36 hours (simulated estimate)'
                    : selectedRailObject.expected_settlement_display || `${selectedRailObject.est_latency_hours}h`}
                </span>
              </div>

              {/* RegTech AML Compliance Notification in Modal */}
              {amlCompliance?.decision === 'REJECT' && (
                <div className="bg-rose-500/15 border border-rose-500/40 p-3 rounded-xl text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <AlertTriangle size={14} />
                    <span>Compliance Block: Sanction Match Detected</span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Screening matched {amlCompliance.matched_target || 'SDN list'} ({Math.round(amlCompliance.risk_score * 100)}% similarity). Transaction cannot be settled.
                  </p>
                </div>
              )}

              {amlCompliance?.decision === 'MANUAL_REVIEW' && (
                <div className="bg-amber-500/15 border border-amber-500/40 p-3 rounded-xl text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertTriangle size={14} />
                    <span>Compliance Warning: Manual Review Flag</span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Fuzzy screening flagged potential phonetic similarity ({Math.round(amlCompliance.risk_score * 100)}%) against {amlCompliance.matched_target || 'sanction records'}.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-amber-500/30">
                    <input
                      type="checkbox"
                      checked={complianceAcknowledged}
                      onChange={(e) => setComplianceAcknowledged(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-amber-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-amber-300 font-sans font-medium leading-snug">
                      I have reviewed this compliance alert and confirm this simulated transfer is compliant to proceed.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-between py-2 bg-emerald-950/20 px-3 rounded-xl text-sm font-black border border-emerald-500/20">
                <span className="text-gray-200">Total Sender Debit</span>
                <span className="text-emerald-400">
                  {quoteData.sourceCurrency === 'USD'
                    ? `$${(quoteData.sourceAmount + (selectedRailObject.est_fee_usd || 0)).toFixed(2)} USD`
                    : `${quoteData.sourceAmount} ${quoteData.sourceCurrency} + $${selectedRailObject.est_fee_usd?.toFixed(2)} USD`}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmScreen(false)}
                className="w-1/2 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={
                  executing ||
                  amlCompliance?.decision === 'REJECT' ||
                  (amlCompliance?.decision === 'MANUAL_REVIEW' && !complianceAcknowledged)
                }
                className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                {executing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm & Settle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Result View */}
      {txResult && (
        <div className="bg-gradient-to-br from-emerald-950/40 via-gray-950 to-gray-900 border border-emerald-500/40 rounded-2xl p-6 space-y-4 font-mono animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 rounded-xl text-gray-950">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Payment Successfully Settled</h3>
              <p className="text-xs text-gray-400">Clearing Reference: <span className="text-emerald-400 font-bold">{txResult.clearingReference}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950/80 p-3.5 rounded-xl border border-gray-800 text-xs">
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Settlement Rail</span>
              <span className="text-white font-bold">{txResult.transaction?.selectedRail?.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Expected Time</span>
              <span className="text-emerald-400">{txResult.expectedSettlementDisplay}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Simulation Delay</span>
              <span className="text-gray-300">{txResult.simulationDurationMs} ms</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Updated Balance</span>
              <span className="text-white font-bold">{txResult.senderRemainingBalance?.available} {txResult.senderRemainingBalance?.currency}</span>
            </div>
          </div>

          {/* TCA Analytics */}
          {txResult.tca && (
            <TCAAnalytics tca={txResult.tca} aiSavingsUSD={txResult.transaction?.aiSavingsUSD || 0} />
          )}

          {/* View in Transaction History & XML Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowXmlModal(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border border-gray-700 transition-all cursor-pointer"
            >
              <FileText size={14} className="text-emerald-400" />
              View ISO 20022 pacs.008 XML
            </button>

            <a
              href="/transactions"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold underline"
            >
              View Full Double-Entry Ledger & Audit Log →
            </a>
          </div>
        </div>
      )}

      {/* ISO 20022 XML Modal */}
      {showXmlModal && txResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest block">
                  Financial Interoperability Message
                </span>
                <h3 className="text-base font-black text-white">ISO 20022 pacs.008.001.10 XML</h3>
              </div>
              <button
                onClick={() => setShowXmlModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <pre className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-[11px] text-emerald-300 overflow-x-auto max-h-96 font-mono leading-relaxed">
              {txResult.isoXml || txResult.transaction?.isoXmlMessage || '<!-- pacs.008.001.10 generated on settlement -->'}
            </pre>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-gray-400">Standard: pacs.008.001.10 Customer Credit Transfer</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(txResult.isoXml || txResult.transaction?.isoXmlMessage || '');
                    setCopiedXml(true);
                    setTimeout(() => setCopiedXml(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded-lg flex items-center gap-1.5 border border-gray-700 cursor-pointer"
                >
                  <Copy size={13} />
                  {copiedXml ? 'Copied!' : 'Copy XML'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowXmlModal(false)}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-xs text-gray-950 font-bold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 16-Step Interactive Simulation Modal */}
      {showSimulationModal && (
        <TransactionSimulationModal
          isOpen={showSimulationModal}
          onClose={() => setShowSimulationModal(false)}
          sourceCurrency={sourceCurrency}
          destinationCurrency={destinationCurrency}
          amount={Number(amount)}
          receiverEmail={receiverEmail}
          priority={priority}
          onCompleted={(res) => {
            setTxResult(res);
            if (onTransactionComplete) onTransactionComplete(res);
          }}
        />
      )}
    </div>
  );
};

export default MultiRailRouter;
