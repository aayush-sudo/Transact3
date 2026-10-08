import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle, Clock3, Loader2, Sparkles } from 'lucide-react';
import api from '../services/api';
import PaymentSchedulingModal from './PaymentSchedulingModal';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
const PREFERENCES = ['BALANCED', 'CHEAPEST', 'FASTEST'];

const MultiRailRouter = () => {
  const [paymentMode, setPaymentMode] = useState('SEND_AMOUNT');
  const [sourceCurrency, setSourceCurrency] = useState('INR');
  const [destinationCurrency, setDestinationCurrency] = useState('USD');
  const [amount, setAmount] = useState('1000');
  const [priority, setPriority] = useState('BALANCED');
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [selectedRailId, setSelectedRailId] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerQuotes, setProviderQuotes] = useState(null);
  const [providerQuotesLoading, setProviderQuotesLoading] = useState(false);
  const [providerQuotesError, setProviderQuotesError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/user/recipients')
      .then(({ data }) => {
        if (!active || !data.success) return;
        const availableRecipients = data.data || [];
        setRecipients(availableRecipients);
        setRecipientEmail(availableRecipients[0]?.email || '');
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Could not load your saved recipients.');
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCompare = async (event) => {
    event.preventDefault();
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount to compare routes.');
      return;
    }

    setLoading(true);
    setError(null);
    setRouteAnalysis(null);
    setSelectedRailId(null);
    setProviderQuotes(null);
    setProviderQuotesError('');
    try {
      const { data } = await api.post('/orchestration/route', {
        sourceCurrency,
        destinationCurrency,
        amount: Number(amount),
        paymentMode,
        priority
      });
      setRouteAnalysis(data.data);
      setSelectedRailId(data.data.recommendedRail?.id || null);
      setProviderQuotesLoading(true);
      try {
        const { data: comparison } = await api.post('/orchestration/provider-quotes', {
          sourceCurrency,
          destinationCurrency,
          amount: data.data.sourceAmount
        });
        const fetchedAt = Date.now();
        setProviderQuotes({
          ...comparison.data,
          data: comparison.data.data.map((provider) => ({
            ...provider,
            isStale: provider.dateCollected
              ? fetchedAt - new Date(provider.dateCollected).getTime() > 24 * 60 * 60 * 1000
              : false
          }))
        });
      } catch (providerError) {
        setProviderQuotesError(providerError.response?.data?.message || 'Live provider comparisons are temporarily unavailable.');
      } finally {
        setProviderQuotesLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not compare routes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedRail = routeAnalysis?.evaluatedRails?.find((rail) => rail.id === selectedRailId);
  const paymentParams = useMemo(() => ({
    sourceCurrency,
    destinationCurrency,
    amount: Number(amount),
    paymentMode,
    priority,
    receiverEmail: recipientEmail,
    selectedRailId
  }), [sourceCurrency, destinationCurrency, amount, paymentMode, priority, recipientEmail, selectedRailId]);

  return (
    <section className="card space-y-6">
      <header className="flex flex-col gap-1 border-b border-slate-200 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Transfer comparison</p>
        <h2 className="text-2xl font-bold text-slate-900">Compare available routes</h2>
        <p className="text-sm text-slate-600">
          Compare the three modeled routes and schedule an internal settlement using your wallet balance.
        </p>
      </header>

      <form onSubmit={handleCompare} className="space-y-5">
        <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
          {[
            ['SEND_AMOUNT', 'I send'],
            ['RECIPIENT_GETS', 'Recipient receives']
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPaymentMode(mode)}
              className={`rounded-lg px-4 py-2 font-semibold transition-colors ${
                paymentMode === mode ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="currency-corridor" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Currency corridor
            </label>
            <div className="flex items-center gap-2">
              <select
                id="currency-corridor"
                value={sourceCurrency}
                onChange={(event) => {
                  const nextSource = event.target.value;
                  setSourceCurrency(nextSource);
                  if (destinationCurrency === nextSource) {
                    setDestinationCurrency(CURRENCIES.find((currency) => currency !== nextSource));
                  }
                }}
                className="input-field"
                aria-label="Source currency"
              >
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
              <ArrowRight size={18} className="shrink-0 text-emerald-700" />
              <select
                value={destinationCurrency}
                onChange={(event) => setDestinationCurrency(event.target.value)}
                className="input-field"
                aria-label="Destination currency"
              >
                {CURRENCIES.filter((currency) => currency !== sourceCurrency).map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="comparison-amount" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Amount ({paymentMode === 'SEND_AMOUNT' ? sourceCurrency : destinationCurrency})
            </label>
            <input
              id="comparison-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="input-field"
              required
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">Compare by</legend>
          <div className="flex flex-wrap gap-2">
            {PREFERENCES.map((preference) => (
              <button
                key={preference}
                type="button"
                onClick={() => setPriority(preference)}
                aria-pressed={priority === preference}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                  priority === preference
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {preference.charAt(0) + preference.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Estimates are informational and may differ from provider offers.</p>
          <button type="submit" disabled={loading} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Compare routes
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {routeAnalysis && (
        <div className="space-y-4 border-t border-slate-200 pt-5">
          {routeAnalysis.fxAnalysis && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-950">
                <Activity size={17} className="text-sky-700" />
                Exchange-rate outlook
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="block text-xs text-slate-500">Current rate</span>1 {sourceCurrency} = {routeAnalysis.fxAnalysis.currentRate} {destinationCurrency}</p>
                <p><span className="block text-xs text-slate-500">24-hour average</span>{routeAnalysis.fxAnalysis.sma24h}</p>
                <p><span className="block text-xs text-slate-500">Volatility</span>{routeAnalysis.fxAnalysis.volatility}%</p>
                <p><span className="block text-xs text-slate-500">Guidance</span>{routeAnalysis.fxAnalysis.classification}</p>
              </div>
            </div>
          )}
          <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div>
              <h3 className="font-bold text-sky-950">Provider comparison snapshots</h3>
              <p className="mt-1 text-xs text-sky-900">
                Independent provider-reported quotes for {routeAnalysis.sourceAmount} {sourceCurrency} → {destinationCurrency}; collection times vary and these are not binding offers.
              </p>
            </div>
            {providerQuotesLoading ? (
              <p className="flex items-center gap-2 text-sm text-sky-900"><Loader2 size={15} className="animate-spin" /> Fetching current provider comparisons…</p>
            ) : providerQuotesError ? (
              <p role="status" className="text-sm text-amber-900">{providerQuotesError}</p>
            ) : providerQuotes?.data?.length ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {providerQuotes.data.slice(0, 6).map((provider, index) => {
                    const collectedAt = provider.dateCollected ? new Date(provider.dateCollected) : null;
                    return (
                      <article key={`${provider.name}-${index}`} className="rounded-lg border border-sky-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{provider.name}</h4>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] uppercase text-slate-500">
                              {provider.type === 'bank' ? 'Bank' : 'Transfer provider'}
                            </span>
                            {provider.isStale && <span className="text-[10px] font-semibold text-amber-700">Older than 24 hours</span>}
                          </div>
                        </div>
                        <dl className="mt-2 space-y-1.5 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Provider fee{provider.feeCurrency ? ` (${provider.feeCurrency})` : ' (currency not supplied)'}</dt>
                            <dd className="font-semibold text-slate-900">
                              {provider.fee == null ? 'Not reported' : Number(provider.fee).toFixed(2)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Quoted rate</dt>
                            <dd className="font-semibold text-slate-900">{Number(provider.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Recipient receives</dt>
                            <dd className="font-semibold text-slate-900">{Number(provider.receivedAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {destinationCurrency}</dd>
                          </div>
                          {provider.markupPct != null && (
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-500">Reported markup</dt>
                              <dd className="font-semibold text-slate-900">{Number(provider.markupPct).toFixed(2)}%</dd>
                            </div>
                          )}
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Quote collected</dt>
                            <dd className="font-semibold text-slate-900">
                              {collectedAt ? collectedAt.toLocaleString() : 'Not supplied'}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Delivery estimate</dt>
                            <dd className="font-semibold text-slate-900">
                              {provider.deliveryEstimation?.deliveryDate?.min
                                ? new Date(provider.deliveryEstimation.deliveryDate.min).toLocaleString()
                                : 'Not supplied'}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
                <p className="text-[11px] text-sky-900">
                  Source: public provider comparison feed · fetched {providerQuotes.timestamp ? new Date(providerQuotes.timestamp).toLocaleString() : 'recently'}. Quote collection dates vary by provider. Offers are non-binding; confirm directly before paying.
                </p>
              </>
            ) : (
              <p className="text-sm text-sky-900">{providerQuotes?.message || 'No current provider quotes were returned for this currency pair.'}</p>
            )}
          </section>
          {routeAnalysis.timingRecommendation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">
                FX timing: {routeAnalysis.timingRecommendation.deferHours > 0
                  ? `wait ${routeAnalysis.timingRecommendation.deferHours} hour${routeAnalysis.timingRecommendation.deferHours === 1 ? '' : 's'}`
                  : 'proceed without an FX delay'}
              </p>
              <p className="mt-1 text-xs text-amber-900">{routeAnalysis.timingRecommendation.reason}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">Three route options</h3>
                <p className="text-xs text-slate-500">Ranked against your selected preference; route fees below are modeled baselines, not provider tariffs.</p>
              </div>
              <span className="text-xs text-slate-500">{routeAnalysis.evaluatedRails?.length || 0} routes</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {routeAnalysis.evaluatedRails?.map((rail) => {
                const recommended = rail.id === routeAnalysis.recommendedRail?.id;
                const selected = rail.id === selectedRailId;
                return (
                  <button
                    key={rail.id}
                    type="button"
                    onClick={() => rail.is_eligible && setSelectedRailId(rail.id)}
                    disabled={!rail.is_eligible}
                    aria-pressed={selected}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-900">{rail.name}</h4>
                      {recommended && <span className="rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Suggested</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{rail.description}</p>
                    {!rail.is_eligible && <p className="mt-2 text-xs text-rose-700">{rail.rejection_reason}</p>}
                    <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Modeled fee estimate</dt>
                        <dd className="font-semibold text-slate-900">${Number(rail.est_fee_usd || 0).toFixed(2)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="flex items-center gap-1 text-slate-500"><Clock3 size={13} /> Estimated time</dt>
                        <dd className="font-semibold text-slate-900">{rail.expected_settlement_display || `${rail.est_latency_hours} hours`}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Reliability estimate</dt>
                        <dd className="font-semibold text-slate-900">{Math.round((rail.reliability_score || 0.99) * 100)}%</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRail && (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-2 text-sm text-emerald-950">
                <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                <p><strong>Selected route:</strong> {selectedRail.name}</p>
              </div>
              <p className="text-xs text-slate-600">
                Settlement is scheduled using the selected route estimate and FX guidance. Your wallet balance and route capacity are reserved until settlement.
              </p>
              <p className="text-xs text-slate-500">
                This is an internal route simulation only. No instant-payment, card, or bank network is connected; actual delivery depends on an enabled provider and corridor. Wallet funding uses Razorpay test mode.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm font-semibold text-slate-800">
                  Recipient
                  <select
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    className="input-field mt-1"
                    disabled={recipients.length === 0}
                  >
                    {recipients.length === 0 && <option value="">No saved recipients available</option>}
                    {recipients.map((recipient) => (
                      <option key={recipient._id || recipient.email} value={recipient.email}>
                        {recipient.name} ({recipient.email})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmation(true)}
                  disabled={recipients.length === 0}
                  className="btn-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle size={16} />
                  Review and schedule
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showConfirmation && (
        <PaymentSchedulingModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          initialParams={paymentParams}
        />
      )}
    </section>
  );
};

export default MultiRailRouter;
