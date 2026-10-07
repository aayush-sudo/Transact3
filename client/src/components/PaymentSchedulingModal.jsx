import { useRef, useState } from 'react';
import { CheckCircle, Circle, Loader2, X } from 'lucide-react';
import api from '../services/api';

const STEPS = [
  'Validate recipient and wallet balance',
  'Prepare and review binding quote',
  'Reserve wallet funds and route capacity',
  'Schedule settlement'
];

const PaymentSchedulingModal = ({ isOpen, onClose, initialParams }) => {
  const quoteRequestStarted = useRef(false);
  const confirmationStarted = useRef(false);
  const [stepStatuses, setStepStatuses] = useState(STEPS.map(() => 'PENDING'));
  const [quoting, setQuoting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState('');
  const [quoteData, setQuoteData] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const setStepStatus = (index, status) => {
    setStepStatuses((current) => current.map((value, item) => item === index ? status : value));
  };

  const prepareQuote = async () => {
    if (quoteRequestStarted.current || quoting) return;
    quoteRequestStarted.current = true;
    setQuoting(true);
    setError('');
    setStepStatus(0, 'IN_PROGRESS');
    try {
      const { data } = await api.post('/transaction/quote', {
        sourceCurrency: initialParams.sourceCurrency,
        destinationCurrency: initialParams.destinationCurrency,
        amount: initialParams.amount,
        paymentMode: initialParams.paymentMode,
        priority: initialParams.priority,
        receiverEmail: initialParams.receiverEmail
      });
      const quote = data.data.quote;
      const route = quote.evaluatedRails?.find((rail) => rail.id === initialParams.selectedRailId);
      if (!route?.is_eligible) throw new Error('The selected route is no longer available. Compare routes again.');
      if (data.data.amlCompliance?.decision === 'MANUAL_REVIEW') {
        throw new Error('This recipient requires additional review before a payment can be scheduled.');
      }
      const waitHours = Math.max(
        route.est_latency_hours || 0,
        quote.timingRecommendation?.deferHours || 0
      );
      setStepStatus(0, 'COMPLETED');
      setStepStatus(1, 'COMPLETED');
      setQuoteData({
        quote,
        route,
        senderBalance: data.data.senderBalance.available,
        scheduledEstimate: new Date(Date.now() + waitHours * 3600000)
      });
    } catch (err) {
      quoteRequestStarted.current = false;
      setStepStatus(0, 'FAILED');
      setError(err.response?.data?.message || err.message || 'Could not prepare a payment quote.');
    } finally {
      setQuoting(false);
    }
  };

  const schedulePayment = async () => {
    if (!quoteData || confirmationStarted.current || scheduling) return;
    confirmationStarted.current = true;
    setScheduling(true);
    setError('');
    setStepStatus(2, 'IN_PROGRESS');
    try {
      const { data } = await api.post('/transaction/confirm', {
        quoteId: quoteData.quote.quoteId,
        selectedRail: initialParams.selectedRailId,
        idempotencyKey: `PAY-${quoteData.quote.quoteId}`
      });
      if (!data.success) throw new Error(data.message || 'Could not schedule this payment.');
      setStepStatus(2, 'COMPLETED');
      setStepStatus(3, 'COMPLETED');
      setResult(data.data);
      window.dispatchEvent(new Event('transact3:capacity-changed'));
    } catch (err) {
      confirmationStarted.current = false;
      setStepStatus(2, 'FAILED');
      setError(err.response?.data?.message || err.message || 'Could not schedule this payment.');
    } finally {
      setScheduling(false);
    }
  };

  const feeAmount = quoteData
    ? Number((quoteData.route.est_fee_usd * quoteData.quote.sourceAmount / Math.max(quoteData.quote.sourceAmountUSD, 0.01)).toFixed(2))
    : 0;
  const totalDebit = quoteData ? Number((quoteData.quote.sourceAmount + feeAmount).toFixed(2)) : 0;
  const hasEnoughFunds = quoteData && quoteData.senderBalance >= totalDebit;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-schedule-title"
        className="w-full max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Payment confirmation</p>
            <h2 id="payment-schedule-title" className="mt-1 text-xl font-bold text-slate-900">Review and schedule payment</h2>
            <p className="mt-1 text-sm text-slate-600">
              {initialParams.amount} {initialParams.paymentMode === 'SEND_AMOUNT' ? initialParams.sourceCurrency : initialParams.destinationCurrency}
              {' · '}{initialParams.sourceCurrency} → {initialParams.destinationCurrency}
              {' · '}{initialParams.receiverEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={scheduling}
            aria-label="Close payment confirmation"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Settlement follows the selected route estimate and any FX timing guidance. Confirming reserves the amount from your wallet; it is not settled immediately.
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

        {quoteData && !result && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-bold text-slate-900">Quote summary</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">You send</dt>
                <dd className="font-semibold text-slate-900">{quoteData.quote.sourceAmount} {quoteData.quote.sourceCurrency}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Recipient gets</dt>
                <dd className="font-semibold text-slate-900">{quoteData.quote.destinationAmount} {quoteData.quote.destinationCurrency}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Route fee estimate</dt>
                <dd className="font-semibold text-slate-900">{feeAmount} {quoteData.quote.sourceCurrency}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Total reserved</dt>
                <dd className="font-semibold text-slate-900">{totalDebit} {quoteData.quote.sourceCurrency}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Expected schedule</dt>
                <dd className="font-semibold text-slate-900">{quoteData.scheduledEstimate.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Wallet available</dt>
                <dd className="font-semibold text-slate-900">{quoteData.senderBalance} {quoteData.quote.sourceCurrency}</dd>
              </div>
            </dl>
            {!hasEnoughFunds && (
              <p className="mt-3 text-sm font-semibold text-rose-800">Your wallet balance does not cover the route fee and transfer amount.</p>
            )}
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

        {result && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-bold text-emerald-950">Payment scheduled</h3>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Route</dt>
                <dd className="font-semibold text-slate-900">{result.transaction.selectedRail}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Expected settlement</dt>
                <dd className="font-semibold text-slate-900">{new Date(result.scheduledFor).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd className="font-semibold text-slate-900">{result.transaction.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Reserved amount</dt>
                <dd className="font-semibold text-slate-900">{result.transaction.sourceAmount + result.transaction.railFeeAmount} {result.transaction.sourceCurrency}</dd>
              </div>
            </dl>
          </div>
        )}

        <footer className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          {!result ? (
            <>
              <button type="button" onClick={onClose} disabled={scheduling || quoting} className="btn-secondary">Cancel</button>
              {!quoteData ? (
                <button type="button" onClick={prepareQuote} disabled={quoting} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
                  {quoting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {quoting ? 'Preparing quote…' : 'Review binding quote'}
                </button>
              ) : (
                <button type="button" onClick={schedulePayment} disabled={scheduling || !hasEnoughFunds} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
                  {scheduling ? <Loader2 size={16} className="animate-spin" /> : null}
                  {scheduling ? 'Scheduling…' : 'Confirm and schedule'}
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={onClose} className="btn-primary">Done</button>
          )}
        </footer>
      </section>
    </div>
  );
};

export default PaymentSchedulingModal;
