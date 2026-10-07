import { useRef, useState } from 'react';
import { CheckCircle, Circle, Loader2, X } from 'lucide-react';
import api from '../services/api';

const STEPS = [
  'Validate transfer details',
  'Check recipient and available balance',
  'Prepare transfer quote',
  'Retrieve exchange-rate estimate',
  'Review route options',
  'Check route capacity',
  'Assess recipient compliance',
  'Calculate route costs',
  'Confirm selected route',
  'Authorize simulated transfer',
  'Execute selected route',
  'Record settlement result',
  'Update sample balances',
  'Calculate transfer costs',
  'Record activity',
  'Complete transfer simulation'
];

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const TransactionSimulationModal = ({ isOpen, onClose, initialParams }) => {
  const started = useRef(false);
  const currentStep = useRef(0);
  const [stepStatuses, setStepStatuses] = useState(STEPS.map(() => 'PENDING'));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const setStepStatus = (index, status) => {
    setStepStatuses((current) => current.map((value, item) => item === index ? status : value));
  };

  const runSimulation = async () => {
    if (started.current || running) return;
    started.current = true;
    setRunning(true);
    setError(null);
    currentStep.current = 0;

    try {
      let quote;
      let execution;
      for (let index = 0; index < STEPS.length; index += 1) {
        currentStep.current = index;
        setStepStatus(index, 'IN_PROGRESS');

        if (index === 2) {
          const { data } = await api.post('/transaction/quote', {
            sourceCurrency: initialParams.sourceCurrency,
            destinationCurrency: initialParams.destinationCurrency,
            amount: initialParams.amount,
            paymentMode: initialParams.paymentMode,
            priority: initialParams.priority,
            receiverEmail: initialParams.receiverEmail
          });
          if (!data.success) throw new Error(data.message || 'Could not prepare a transfer quote.');

          quote = data.data.quote;
          const route = quote.evaluatedRails?.find((rail) => rail.id === initialParams.selectedRailId);
          if (!route?.is_eligible) {
            throw new Error('The selected route is no longer available. Compare routes again before retrying.');
          }
          if (data.data.amlCompliance?.decision === 'MANUAL_REVIEW') {
            throw new Error('The selected recipient requires additional review, so the simulation was not executed.');
          }
        }

        if (index === 10) {
          const { data } = await api.post('/transaction/confirm', {
            quoteId: quote.quoteId,
            selectedRail: initialParams.selectedRailId,
            idempotencyKey: `SIM-${quote.quoteId}`
          });
          if (!data.success) throw new Error(data.message || 'The transfer simulation could not be completed.');
          execution = data.data;
        }

        await wait(180);
        setStepStatus(index, 'COMPLETED');
      }
      setResult({ quote, execution });
    } catch (err) {
      setStepStatus(currentStep.current, 'FAILED');
      setError(err.response?.data?.message || err.message || 'The transfer simulation could not be completed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-simulation-title"
        className="w-full max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">One-time transfer simulation</p>
            <h2 id="transfer-simulation-title" className="mt-1 text-xl font-bold text-slate-900">
              Review the selected route
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {initialParams.amount} {initialParams.paymentMode === 'SEND_AMOUNT' ? initialParams.sourceCurrency : initialParams.destinationCurrency}
              {' · '}{initialParams.sourceCurrency} → {initialParams.destinationCurrency}
              {' · '}{initialParams.receiverEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            aria-label="Close transfer simulation"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          This runs once and then stops. It records sample account activity only; no real funds move and no external provider is contacted.
        </p>

        <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {STEPS.map((step, index) => {
            const status = stepStatuses[index];
            return (
              <li key={step} className="flex items-center gap-2 text-sm">
                {status === 'IN_PROGRESS' ? (
                  <Loader2 size={16} className="shrink-0 animate-spin text-emerald-700" />
                ) : (
                  <Circle
                    size={16}
                    className={`shrink-0 ${status === 'COMPLETED' ? 'text-emerald-700' : status === 'FAILED' ? 'text-rose-700' : 'text-slate-300'}`}
                  />
                )}
                <span className={status === 'FAILED' ? 'text-rose-800' : status === 'COMPLETED' ? 'text-slate-600' : 'text-slate-800'}>
                  {step}
                </span>
                {status === 'COMPLETED' && <CheckCircle size={14} className="ml-auto shrink-0 text-emerald-700" />}
              </li>
            );
          })}
        </ol>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        {result && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-bold text-emerald-950">Transfer simulation complete</h3>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Reference</dt>
                <dd className="font-semibold text-slate-900">
                  {result.execution.clearingReference || result.execution.transaction?.clearingReference || 'Recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Selected route</dt>
                <dd className="font-semibold text-slate-900">{result.execution.transaction?.selectedRail || initialParams.selectedRailId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Amount sent</dt>
                <dd className="font-semibold text-slate-900">{result.quote.sourceAmount} {result.quote.sourceCurrency}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Recipient amount</dt>
                <dd className="font-semibold text-slate-900">{result.quote.destinationAmount} {result.quote.destinationCurrency}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Updated sample balance</dt>
                <dd className="font-semibold text-slate-900">
                  {result.execution.senderRemainingBalance?.available ?? '—'} {result.execution.senderRemainingBalance?.currency || result.quote.sourceCurrency}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <footer className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} disabled={running} className="btn-secondary disabled:opacity-50">
            {result || error ? 'Close' : 'Cancel'}
          </button>
          {!result && !error && (
            <button type="button" onClick={runSimulation} disabled={running} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              {running && <Loader2 size={16} className="animate-spin" />}
              {running ? 'Running once…' : 'Start simulation'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};

export default TransactionSimulationModal;
