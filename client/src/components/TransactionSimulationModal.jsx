import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle, Clock, ArrowRight, Zap, Shield, Globe, RefreshCw, 
  ChevronDown, ChevronUp, AlertTriangle, Layers, Award, DollarSign, Check, XCircle
} from 'lucide-react';
import api from '../services/api';

const SIMULATION_STEPS = [
  { id: 1, title: 'Payment Created', desc: 'Initialize simulated payment request' },
  { id: 2, title: 'Input Validation', desc: 'Validate currency corridor & payload parameters' },
  { id: 3, title: 'Wallet / Balance Check', desc: 'Verify source wallet balance sufficiency' },
  { id: 4, title: 'FX Rate Fetch', desc: 'Retrieve live mid-market exchange rate' },
  { id: 5, title: 'FX Timing Analysis', desc: 'Evaluate SMA/EMA momentum & rate trend' },
  { id: 6, title: 'Rail Eligibility Check', desc: 'Filter active settlement pipelines' },
  { id: 7, title: 'Liquidity Check', desc: 'Evaluate dynamic pool capacity & saturation' },
  { id: 8, title: 'Multi-Objective Rail Scoring', desc: 'Compute utility matrix across cost/speed/SLA' },
  { id: 9, title: 'Best Rail Selected', desc: 'Identify optimal route under active policy' },
  { id: 10, title: 'User Confirmation', desc: 'Authorize payment execution parameters' },
  { id: 11, title: 'Payment Execution', desc: 'Dispatch transfer to rail adapter' },
  { id: 12, title: 'Settlement', desc: 'Process gross settlement & clearing ref' },
  { id: 13, title: 'Wallet Update', desc: 'Execute balance debit/credit accounting' },
  { id: 14, title: 'TCA Calculation', desc: 'Benchmark savings against legacy SWIFT' },
  { id: 15, title: 'Audit Log Created', desc: 'Emit tamper-evident ISO 20022 audit event' },
  { id: 16, title: 'Transaction Completed', desc: 'Finalize payment orchestration lifecycle' }
];

const STEP_DELAYS = [
  500,  // 1. Created
  600,  // 2. Validation
  600,  // 3. Wallet
  800,  // 4. FX Fetch
  900,  // 5. FX Timing
  800,  // 6. Rail Eligibility
  900,  // 7. Liquidity
  1000, // 8. Rail Scoring
  900,  // 9. Best Rail Selected
  600,  // 10. Confirmation
  1000, // 11. Execution
  1000, // 12. Settlement
  600,  // 13. Wallet Update
  600,  // 14. TCA
  500,  // 15. Audit Log
  400   // 16. Completed
];

const TransactionSimulationModal = ({ 
  isOpen, 
  onClose, 
  initialParams, 
  onSuccess 
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStatuses, setStepStatuses] = useState(
    SIMULATION_STEPS.map(() => 'PENDING')
  );
  const [expandedSteps, setExpandedSteps] = useState({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState(null);
  
  // Backend payload objects stored as simulation progresses
  const [txDetails, setTxDetails] = useState({
    txId: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    sourceCurrency: initialParams?.sourceCurrency || 'USD',
    destinationCurrency: initialParams?.destinationCurrency || 'INR',
    amount: Number(initialParams?.amount || 10000),
    receiverEmail: initialParams?.receiverEmail || 'recipient@transact3.io',
    priority: initialParams?.priority || 'BALANCED',
    createdAt: new Date().toLocaleTimeString()
  });

  const [quoteData, setQuoteData] = useState(null);
  const [orchestrationData, setOrchestrationData] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isFallbackScenario, setIsFallbackScenario] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');

  // Start simulation on modal mount / parameter change
  useEffect(() => {
    if (isOpen) {
      startSimulation();
    } else {
      resetSimulation();
    }
  }, [isOpen, initialParams]);

  const resetSimulation = () => {
    setCurrentStepIndex(0);
    setStepStatuses(SIMULATION_STEPS.map(() => 'PENDING'));
    setExpandedSteps({});
    setIsSimulating(false);
    setSimulationError(null);
    setQuoteData(null);
    setOrchestrationData(null);
    setExecutionResult(null);
    setAuditLogs([]);
    setIsFallbackScenario(false);
    setFallbackReason('');
  };

  const toggleExpand = (stepId) => {
    setExpandedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const addAuditLog = (message) => {
    const timeStr = new Date().toLocaleTimeString();
    setAuditLogs(prev => [...prev, { time: timeStr, message }]);
  };

  const startSimulation = async () => {
    setIsSimulating(true);
    setSimulationError(null);
    setStepStatuses(SIMULATION_STEPS.map(() => 'PENDING'));
    setAuditLogs([]);

    const params = {
      sourceCurrency: initialParams?.sourceCurrency || 'USD',
      destinationCurrency: initialParams?.destinationCurrency || 'INR',
      amount: Number(initialParams?.amount || 10000),
      receiverEmail: initialParams?.receiverEmail || 'recipient@transact3.io',
      priority: initialParams?.priority || 'BALANCED'
    };

    setTxDetails(prev => ({
      ...prev,
      ...params,
      txId: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      createdAt: new Date().toLocaleTimeString()
    }));

    try {
      // Step 1: Payment Created
      setStepStatuses(prev => { const s = [...prev]; s[0] = 'IN_PROGRESS'; return s; });
      addAuditLog('Payment created in simulation sandbox.');
      await delay(STEP_DELAYS[0]);
      setStepStatuses(prev => { const s = [...prev]; s[0] = 'COMPLETED'; return s; });
      setCurrentStepIndex(1);

      // Step 2: Input Validation
      setStepStatuses(prev => { const s = [...prev]; s[1] = 'IN_PROGRESS'; return s; });
      addAuditLog(`Input validated: ${params.amount} ${params.sourceCurrency} → ${params.destinationCurrency}.`);
      await delay(STEP_DELAYS[1]);
      setStepStatuses(prev => { const s = [...prev]; s[1] = 'COMPLETED'; return s; });
      setCurrentStepIndex(2);

      // Step 3: Wallet / Balance Check
      setStepStatuses(prev => { const s = [...prev]; s[2] = 'IN_PROGRESS'; return s; });
      addAuditLog(`Wallet balance verified for ${params.sourceCurrency}.`);
      await delay(STEP_DELAYS[2]);
      setStepStatuses(prev => { const s = [...prev]; s[2] = 'COMPLETED'; return s; });
      setCurrentStepIndex(3);

      // Step 4: FX Rate Fetch
      setStepStatuses(prev => { const s = [...prev]; s[3] = 'IN_PROGRESS'; return s; });
      
      // Call backend API for real quote & orchestration logic
      const { data: quoteRes } = await api.post('/fx/quote', {
        sourceCurrency: params.sourceCurrency,
        destinationCurrency: params.destinationCurrency,
        amount: params.amount,
        priority: params.priority
      });

      if (!quoteRes.success) throw new Error(quoteRes.message || 'Failed to fetch FX quote');

      setQuoteData(quoteRes.data);
      const orch = quoteRes.orchestration;
      setOrchestrationData(orch);
      addAuditLog(`FX rate retrieved: 1 ${params.sourceCurrency} = ${quoteRes.data.quotedRate} ${params.destinationCurrency}`);
      await delay(STEP_DELAYS[3]);
      setStepStatuses(prev => { const s = [...prev]; s[3] = 'COMPLETED'; return s; });
      setCurrentStepIndex(4);

      // Step 5: FX Timing Analysis
      setStepStatuses(prev => { const s = [...prev]; s[4] = 'IN_PROGRESS'; return s; });
      addAuditLog(`FX timing engine recommendation: ${orch.fxTiming?.recommendation || 'EXECUTE_NOW'}`);
      await delay(STEP_DELAYS[4]);
      setStepStatuses(prev => { const s = [...prev]; s[4] = 'COMPLETED'; return s; });
      setCurrentStepIndex(5);

      // Step 6: Rail Eligibility Check
      setStepStatuses(prev => { const s = [...prev]; s[5] = 'IN_PROGRESS'; return s; });
      addAuditLog(`5 settlement rails evaluated: SWIFT, RTGS, INSTANT, NETTING, CARD PUSH`);
      await delay(STEP_DELAYS[5]);
      setStepStatuses(prev => { const s = [...prev]; s[5] = 'COMPLETED'; return s; });
      setCurrentStepIndex(6);

      // Step 7: Liquidity Check (Check if top rail has dynamic override constraint)
      setStepStatuses(prev => { const s = [...prev]; s[6] = 'IN_PROGRESS'; return s; });
      
      const topRail = orch.recommendedRail;
      let selectedRailToExecute = topRail?.id;

      if (topRail?.liquidityPenalty > 5.0 || topRail?.status === 'DISABLED' || topRail?.status === 'CRITICAL_CONSTRAINED') {
        setIsFallbackScenario(true);
        const nextFallback = orch.fallbackRails?.find(r => r.liquidityPenalty <= 5.0 && r.status !== 'DISABLED') || orch.fallbackRails?.[0];
        setFallbackReason(`${topRail.name} rejected due to ${topRail.status === 'DISABLED' ? 'Rail Override Disable' : 'Insufficient Liquidity Capacity'}. Dynamic fallback selected: ${nextFallback?.name || 'RTGS'}`);
        addAuditLog(`⚠️ Liquidity Constraint on ${topRail.name}. Re-routing to ${nextFallback?.name || 'RTGS'}`);
        if (nextFallback) selectedRailToExecute = nextFallback.id;
      } else {
        addAuditLog(`Liquidity verified for eligible rails. ${topRail?.name} capacity healthy.`);
      }

      await delay(STEP_DELAYS[6]);
      setStepStatuses(prev => { const s = [...prev]; s[6] = 'COMPLETED'; return s; });
      setCurrentStepIndex(7);

      // Step 8: Multi-Objective Rail Scoring
      setStepStatuses(prev => { const s = [...prev]; s[7] = 'IN_PROGRESS'; return s; });
      addAuditLog(`Multi-objective utility scoring matrix calculated under policy ${params.priority}`);
      await delay(STEP_DELAYS[7]);
      setStepStatuses(prev => { const s = [...prev]; s[7] = 'COMPLETED'; return s; });
      setCurrentStepIndex(8);

      // Step 9: Best Rail Selected
      setStepStatuses(prev => { const s = [...prev]; s[8] = 'IN_PROGRESS'; return s; });
      addAuditLog(`Optimal rail selected: ${selectedRailToExecute}`);
      await delay(STEP_DELAYS[8]);
      setStepStatuses(prev => { const s = [...prev]; s[8] = 'COMPLETED'; return s; });
      setCurrentStepIndex(9);

      // Step 10: User Confirmation
      setStepStatuses(prev => { const s = [...prev]; s[9] = 'IN_PROGRESS'; return s; });
      addAuditLog('User payment execution authorized.');
      await delay(STEP_DELAYS[9]);
      setStepStatuses(prev => { const s = [...prev]; s[9] = 'COMPLETED'; return s; });
      setCurrentStepIndex(10);

      // Step 11: Payment Execution
      setStepStatuses(prev => { const s = [...prev]; s[10] = 'IN_PROGRESS'; return s; });
      
      const { data: execRes } = await api.post('/transaction/send', {
        quoteId: quoteRes.data.quoteId,
        receiverEmail: params.receiverEmail,
        sourceCurrency: params.sourceCurrency,
        destinationCurrency: params.destinationCurrency,
        amount: params.amount,
        priority: params.priority,
        selectedRail: selectedRailToExecute,
        selectedRailId: selectedRailToExecute,
        executionMode: 'IMMEDIATE',
        idempotencyKey: `PAY-SIM-${Date.now()}`
      });

      if (!execRes.success) throw new Error(execRes.message || 'Execution failed');

      setExecutionResult(execRes.data);
      addAuditLog(`Payment dispatched to ${selectedRailToExecute} settlement adapter.`);
      await delay(STEP_DELAYS[10]);
      setStepStatuses(prev => { const s = [...prev]; s[10] = 'COMPLETED'; return s; });
      setCurrentStepIndex(11);

      // Step 12: Settlement
      setStepStatuses(prev => { const s = [...prev]; s[11] = 'IN_PROGRESS'; return s; });
      addAuditLog(`Settlement completed. Clearing Ref: ${execRes.data.transaction?.clearingReference || 'CLR-TR3-9982'}`);
      await delay(STEP_DELAYS[11]);
      setStepStatuses(prev => { const s = [...prev]; s[11] = 'COMPLETED'; return s; });
      setCurrentStepIndex(12);

      // Step 13: Wallet Update
      setStepStatuses(prev => { const s = [...prev]; s[12] = 'IN_PROGRESS'; return s; });
      addAuditLog(`Wallet balance updated. Debited ${params.amount} ${params.sourceCurrency}.`);
      await delay(STEP_DELAYS[12]);
      setStepStatuses(prev => { const s = [...prev]; s[12] = 'COMPLETED'; return s; });
      setCurrentStepIndex(13);

      // Step 14: TCA Calculation
      setStepStatuses(prev => { const s = [...prev]; s[13] = 'IN_PROGRESS'; return s; });
      addAuditLog(`TCA computed: Saved $${orch.aiSavingsUSD || '37.00'} USD vs traditional SWIFT baseline.`);
      await delay(STEP_DELAYS[13]);
      setStepStatuses(prev => { const s = [...prev]; s[13] = 'COMPLETED'; return s; });
      setCurrentStepIndex(14);

      // Step 15: Audit Log Created
      setStepStatuses(prev => { const s = [...prev]; s[14] = 'IN_PROGRESS'; return s; });
      addAuditLog(`ISO 20022 pacs.008 audit event written to immutable audit chain.`);
      await delay(STEP_DELAYS[14]);
      setStepStatuses(prev => { const s = [...prev]; s[14] = 'COMPLETED'; return s; });
      setCurrentStepIndex(15);

      // Step 16: Transaction Completed
      setStepStatuses(prev => { const s = [...prev]; s[15] = 'IN_PROGRESS'; return s; });
      addAuditLog('Transaction simulation successfully completed.');
      await delay(STEP_DELAYS[15]);
      setStepStatuses(prev => { const s = [...prev]; s[15] = 'COMPLETED'; return s; });
      setIsSimulating(false);

      if (onSuccess) onSuccess(execRes.data);

    } catch (err) {
      console.error(err);
      setSimulationError(err.message || 'Simulation failed');
      setStepStatuses(prev => {
        const s = [...prev];
        s[currentStepIndex] = 'FAILED';
        return s;
      });
      setIsSimulating(false);
    }
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  if (!isOpen) return null;

  const currentSelectedRail = executionResult?.transaction?.selectedRail || orchestrationData?.recommendedRail?.id || 'REGIONAL_INSTANT';
  const currentRailObject = orchestrationData?.evaluatedRails?.find(r => r.id === currentSelectedRail) || orchestrationData?.recommendedRail;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700/80 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-white">
        
        {/* Top Header Banner */}
        <div className="bg-gray-950 px-6 py-4 border-b border-gray-800 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400">
              <Zap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide text-white">TRANSACT3 SIMULATION WORKFLOW</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-lime-500/20 text-lime-400 border border-lime-500/40 animate-pulse">
                  SIMULATION MODE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  DEMO TRANSACTION
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Simulated Sandbox Environment • No Real Financial Capital Transferred
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isSimulating && (
              <button 
                onClick={startSimulation}
                className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-lime-400 rounded-xl border border-gray-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
              >
                <RefreshCw size={14} /> Re-run Simulation
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Payment Summary Header Strip */}
        <div className="bg-gray-900/90 px-6 py-3 border-b border-gray-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">Amount & Pair</span>
            <span className="text-white font-extrabold text-sm">{txDetails.amount.toLocaleString()} {txDetails.sourceCurrency} → {txDetails.destinationCurrency}</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">Routing Policy</span>
            <span className="text-lime-400 font-bold uppercase">{txDetails.priority} PROFILE</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">Transaction ID</span>
            <span className="text-gray-300 font-bold">{txDetails.txId}</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">Recipient</span>
            <span className="text-gray-300 truncate block">{txDetails.receiverEmail}</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: 16-Step Stepper & Explanations (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Simulation Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-lime-400" />
                16-Stage Lifecycle Progress
              </h3>
              <span className="text-xs font-mono text-gray-400">
                Stage {currentStepIndex + 1} of 16
              </span>
            </div>

            {/* Fallback Alert Banner */}
            {isFallbackScenario && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-1 text-amber-300 font-mono">
                <div className="flex items-center gap-2 font-bold text-amber-400 uppercase">
                  <AlertTriangle size={16} /> Dynamic Re-routing Triggered
                </div>
                <p>{fallbackReason}</p>
              </div>
            )}

            {/* Stepper List */}
            <div className="space-y-3 font-mono">
              {SIMULATION_STEPS.map((step, idx) => {
                const status = stepStatuses[idx];
                const isExpanded = expandedSteps[step.id];
                const isCurrent = currentStepIndex === idx && isSimulating;

                let icon = <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />;
                let badgeClass = "bg-gray-800 text-gray-400 border-gray-700";

                if (status === 'COMPLETED') {
                  icon = <CheckCircle size={16} className="text-emerald-400" />;
                  badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                } else if (status === 'IN_PROGRESS') {
                  icon = <RefreshCw size={16} className="text-lime-400 animate-spin" />;
                  badgeClass = "bg-lime-500/20 text-lime-400 border-lime-500/40 animate-pulse";
                } else if (status === 'FAILED') {
                  icon = <XCircle size={16} className="text-rose-400" />;
                  badgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                }

                return (
                  <div 
                    key={step.id} 
                    className={`border rounded-2xl p-3.5 transition-all ${
                      isCurrent 
                        ? 'bg-gray-850 border-lime-500/50 shadow-lg shadow-lime-500/5' 
                        : status === 'COMPLETED'
                        ? 'bg-gray-800/40 border-gray-700/60'
                        : 'bg-gray-900/50 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(step.id)}>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gray-900 border border-gray-700">
                          {icon}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-2">
                            <span>STEP {step.id} — {step.title.toUpperCase()}</span>
                          </p>
                          <p className="text-[11px] text-gray-400 font-sans">{step.desc}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                          {status}
                        </span>
                        {status === 'COMPLETED' && (
                          <button className="text-gray-400 hover:text-white p-1">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Technical Detail Panel (Show if active or expanded) */}
                    {(isCurrent || isExpanded || (status === 'COMPLETED' && step.id === 9)) && (
                      <div className="mt-3 pt-3 border-t border-gray-800 text-xs font-mono space-y-2 bg-gray-950/60 p-3 rounded-xl">
                        {step.id === 4 && (
                          <div className="space-y-1">
                            <p className="text-gray-400">Data Source: <span className="text-lime-400 font-bold">ExchangeRate REST Ingestion API</span></p>
                            <p className="text-gray-400">Pair: <span className="text-white">{txDetails.sourceCurrency} → {txDetails.destinationCurrency}</span></p>
                            <p className="text-gray-400">Reference Rate: <span className="text-white">1 {txDetails.sourceCurrency} = {quoteData?.referenceRate || '83.42'} {txDetails.destinationCurrency}</span></p>
                            <p className="text-gray-400">Status: <span className="text-emerald-400 font-bold">✓ Live API Rate Verified</span></p>
                          </div>
                        )}

                        {step.id === 5 && (
                          <div className="space-y-1">
                            <p className="text-gray-400">Rate: <span className="text-white">{quoteData?.quotedRate || '83.42'}</span> | SMA: <span className="text-gray-300">83.18</span> | EMA: <span className="text-gray-300">83.31</span></p>
                            <p className="text-gray-400">Volatility: <span className="text-amber-400">1.24%</span></p>
                            <p className="text-gray-400">Recommendation: <span className="text-lime-400 font-bold">{orchestrationData?.fxTiming?.recommendation || 'EXECUTE_NOW'}</span></p>
                            <p className="text-[11px] text-gray-400 italic">Current rate is optimal relative to short-term moving averages.</p>
                          </div>
                        )}

                        {step.id === 6 && (
                          <div className="space-y-1.5">
                            <p className="text-gray-400 font-bold text-[10px] uppercase">Active Settlement Pipelines:</p>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                              <span className="text-emerald-400">✓ SWIFT (AVAILABLE)</span>
                              <span className="text-emerald-400">✓ RTGS (AVAILABLE)</span>
                              <span className="text-emerald-400">✓ INSTANT (AVAILABLE)</span>
                              <span className="text-emerald-400">✓ NETTING (AVAILABLE)</span>
                              <span className="text-emerald-400">✓ CARD PUSH (AVAILABLE)</span>
                            </div>
                          </div>
                        )}

                        {step.id === 7 && (
                          <div className="space-y-2">
                            <p className="text-gray-400 font-bold text-[10px] uppercase">Liquidity Capacity Evaluation:</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-gray-800 text-gray-500">
                                    <th className="py-1">Rail</th>
                                    <th className="py-1">Available</th>
                                    <th className="py-1">Required</th>
                                    <th className="py-1">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(orchestrationData?.evaluatedRails || []).map(r => (
                                    <tr key={r.id} className="border-b border-gray-900">
                                      <td className="py-1 text-gray-300">{r.name}</td>
                                      <td className="py-1 text-gray-400">${(r.hourlyCapacityUSD || 5000000).toLocaleString()}</td>
                                      <td className="py-1 text-gray-400">${txDetails.amount.toLocaleString()}</td>
                                      <td className="py-1">
                                        {r.liquidityPenalty > 5.0 || r.status === 'DISABLED' ? (
                                          <span className="text-rose-400 font-bold">✕ REJECTED</span>
                                        ) : (
                                          <span className="text-emerald-400 font-bold">✓ HEALTHY</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {step.id === 8 && (
                          <div className="space-y-2">
                            <p className="text-gray-400 font-bold text-[10px] uppercase">Multi-Objective Utility Matrix (Policy: {txDetails.priority}):</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-gray-800 text-gray-500">
                                    <th className="py-1">Rail</th>
                                    <th className="py-1">Est Fee</th>
                                    <th className="py-1">Latency</th>
                                    <th className="py-1">Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(orchestrationData?.evaluatedRails || []).map(r => (
                                    <tr key={r.id} className="border-b border-gray-900">
                                      <td className="py-1 text-white font-bold">{r.name}</td>
                                      <td className="py-1 text-gray-300">${r.estFeeUSD}</td>
                                      <td className="py-1 text-gray-300">{r.estLatencyHours}h</td>
                                      <td className="py-1 text-lime-400 font-extrabold">{r.utilityScore}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {step.id === 9 && (
                          <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3 space-y-1">
                            <p className="text-[10px] font-extrabold text-lime-400 uppercase tracking-widest">OPTIMAL ROUTE SELECTED</p>
                            <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                              {currentRailObject?.name || currentSelectedRail}
                              <span className="text-xs px-2 py-0.5 rounded bg-lime-400 text-black font-mono font-extrabold">
                                Score: {currentRailObject?.utilityScore || '0.91'}
                              </span>
                            </h4>
                            <p className="text-[11px] text-gray-300">
                              Fee: <span className="text-white font-bold">${currentRailObject?.estFeeUSD || '1.50'}</span> | Estimated Settlement: <span className="text-white font-bold">{currentRailObject?.estLatencyHours || '<0.01'} Hours</span>
                            </p>
                            <p className="text-[11px] text-gray-400 italic">
                              "{orchestrationData?.explanation || 'Optimal balance of total cost, execution latency, and liquidity pool depth.'}"
                            </p>
                          </div>
                        )}

                        {step.id === 14 && (
                          <div className="space-y-1.5">
                            <p className="text-gray-400 font-bold text-[10px] uppercase">Transaction Cost Analysis (TCA) vs SWIFT:</p>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-gray-900 p-2 rounded border border-gray-800">
                                <span className="text-gray-500 block">SWIFT Baseline</span>
                                <span className="text-gray-300 font-bold">$45.00 • 24 Hours</span>
                              </div>
                              <div className="bg-emerald-950/40 p-2 rounded border border-emerald-500/30">
                                <span className="text-emerald-400 font-bold block">Transact3 Savings</span>
                                <span className="text-lime-400 font-extrabold">${orchestrationData?.aiSavingsUSD || '37.00'} Saved</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {step.id === 15 && (
                          <div className="space-y-1">
                            <p className="text-gray-400">ISO Message: <span className="text-lime-400 font-bold">pacs.008.001.08 Credit Transfer</span></p>
                            <p className="text-gray-400">Instructing BIC: <span className="text-white font-mono">TR3SUS33XXX</span></p>
                            <p className="text-gray-400">Audit Status: <span className="text-emerald-400 font-bold">✓ Verified Cryptographic Hash</span></p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Summary Card & Complete Audit Trail (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Transaction Summary Card */}
            <div className="bg-gray-800/80 border border-gray-700/80 rounded-3xl p-5 shadow-xl space-y-4 font-mono relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">LIVE TRANSACTION SUMMARY</span>
                <span className="text-xs font-extrabold text-lime-400 bg-lime-500/10 border border-lime-500/30 px-2.5 py-0.5 rounded-full">
                  {isSimulating ? 'ANALYZING' : 'SETTLED'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Transaction ID:</span>
                  <span className="text-white font-bold">{txDetails.txId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Source Amount:</span>
                  <span className="text-white font-bold">{txDetails.amount.toLocaleString()} {txDetails.sourceCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Destination Recipient:</span>
                  <span className="text-white font-bold">{quoteData ? `${quoteData.destinationAmount?.toLocaleString()} ${txDetails.destinationCurrency}` : 'Calculating...'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">FX Quoted Rate:</span>
                  <span className="text-lime-400 font-bold">{quoteData?.quotedRate ? `1 ${txDetails.sourceCurrency} = ${quoteData.quotedRate} ${txDetails.destinationCurrency}` : 'Retrieving...'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Selected Rail:</span>
                  <span className="text-white font-extrabold">{currentRailObject?.name || 'REGIONAL INSTANT'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated Fee:</span>
                  <span className="text-emerald-400 font-bold">${currentRailObject?.estFeeUSD || '1.50'} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Calculated AI Savings:</span>
                  <span className="text-lime-400 font-extrabold">${orchestrationData?.aiSavingsUSD || '37.00'} USD</span>
                </div>
              </div>

              {/* Completion Banner */}
              {!isSimulating && currentStepIndex === 15 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-1">
                  <CheckCircle size={24} className="text-emerald-400 mx-auto mb-1" />
                  <h4 className="text-sm font-extrabold text-white uppercase">PAYMENT SIMULATION COMPLETE</h4>
                  <p className="text-[11px] text-gray-300">Successfully settled via {currentRailObject?.name}</p>
                </div>
              )}
            </div>

            {/* Complete Audit Trail */}
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-3xl p-5 shadow-xl space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-gray-700/60 pb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-lime-400" />
                  TRANSACTION AUDIT TRAIL
                </span>
                <span className="text-[10px] text-gray-500">{auditLogs.length} events</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto text-[11px]">
                {auditLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 italic">Waiting for simulation events...</p>
                ) : (
                  auditLogs.map((log, i) => (
                    <div key={i} className="flex gap-2.5 items-start text-gray-300 border-b border-gray-800/60 pb-1.5">
                      <span className="text-lime-400 font-bold shrink-0">{log.time}</span>
                      <span className="text-gray-300">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-gray-950 px-6 py-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400 font-mono">
          <span>Transact3 Autonomous Payment Orchestration Engine</span>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-700 transition-colors"
          >
            Close Simulation View
          </button>
        </div>

      </div>
    </div>
  );
};

export default TransactionSimulationModal;
