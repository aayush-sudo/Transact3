import { useEffect, useState } from 'react';
import FXForecastChart from '../components/FXForecastChart';
import api from '../services/api';
import { ArrowRightLeft, Calculator, Loader2 } from 'lucide-react';

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'AED', 'CHF', 'CAD', 'AUD', 'HKD', 'SEK', 'ZAR'];

const isForecastPairAvailable = (pairs, base, target) => {
  if (!pairs) return true;
  const listed = (source, destination) => pairs.has(`${source}/${destination}`)
    || pairs.has(`${destination}/${source}`);
  return listed(base, target) || (listed('USD', base) && listed('USD', target));
};

const FXForecasting = () => {
  const [currencies, setCurrencies] = useState(DEFAULT_CURRENCIES);
  const [currencyNames, setCurrencyNames] = useState({});
  const [paymentCurrencies, setPaymentCurrencies] = useState(['USD', 'EUR', 'GBP', 'INR', 'BRL', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']);
  const [supportedPairs, setSupportedPairs] = useState(null);
  const [currencyListError, setCurrencyListError] = useState('');
  const [base, setBase] = useState('USD');
  const [target, setTarget] = useState('INR');
  const [converterAmount, setConverterAmount] = useState('100');
  const [conversion, setConversion] = useState(null);
  const [conversionError, setConversionError] = useState('');
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/fx/currencies'), api.get('/fx/pairs')])
      .then(([currencyResponse, pairResponse]) => {
        const available = Array.isArray(currencyResponse.data.data) ? currencyResponse.data.data : [];
        const pairList = Array.isArray(pairResponse.data.data) ? pairResponse.data.data : [];
        if (!available.length || !pairList.length) throw new Error('The forecast currency or pair catalog was empty.');
        if (!active) return;
        const pairs = new Set(pairList.map((pair) => String(pair).toUpperCase()));
        const pairCurrencies = new Set(pairList.flatMap((pair) => String(pair).toUpperCase().split('/')));
        const supportedCurrencies = available.filter(({ code }) => pairCurrencies.has(code));
        const codes = supportedCurrencies.map(({ code }) => code);
        setCurrencies(codes);
        setCurrencyNames(Object.fromEntries(available.map(({ code, name }) => [code, name])));
        setPaymentCurrencies(available.filter(({ paymentSupported }) => paymentSupported).map(({ code }) => code));
        setSupportedPairs(pairs);
      })
      .catch((error) => {
        console.error('Failed to load the Twelve Data forecast catalog', error);
        if (active) setCurrencyListError('Could not load the Twelve Data pair catalog; showing common currency choices.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supportedPairs) return;
    const targets = currencies.filter((code) => code !== base
      && isForecastPairAvailable(supportedPairs, base, code));
    if (!targets.includes(target)) setTarget(targets[0] || '');
  }, [currencies, supportedPairs, base, target]);

  const selectBaseCurrency = (nextBase) => {
    setBase(nextBase);
    if (nextBase === target) {
      setTarget(currencies.find((code) => code !== nextBase
        && isForecastPairAvailable(supportedPairs, nextBase, code)));
    } else if (!isForecastPairAvailable(supportedPairs, nextBase, target)) {
      setTarget(currencies.find((code) => code !== nextBase
        && isForecastPairAvailable(supportedPairs, nextBase, code)));
    }
    setConversion(null);
    setConversionError('');
  };

  const selectTargetCurrency = (nextTarget) => {
    setTarget(nextTarget);
    setConversion(null);
    setConversionError('');
  };

  const convertAmount = async (event) => {
    event.preventDefault();
    if (!paymentCurrencies.includes(base) || !paymentCurrencies.includes(target)) {
      setConversion(null);
      setConversionError('Quick conversion is available only for payment-supported currencies. The hourly forecast is still available for this pair.');
      return;
    }
    setConverting(true);
    setConversionError('');
    try {
      const { data } = await api.post('/currency/convert', {
        base,
        target,
        amount: Number(converterAmount)
      });
      setConversion(data);
    } catch (err) {
      setConversion(null);
      setConversionError(err.response?.data?.message || 'Could not convert this amount.');
    } finally {
      setConverting(false);
    }
  };
  const canConvert = paymentCurrencies.includes(base) && paymentCurrencies.includes(target);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-1">
            FX REFERENCE DATA
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900">Exchange-rate outlook</h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={base}
            onChange={(e) => selectBaseCurrency(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800"
          >
            {currencies.map(c => <option key={c} value={c}>{c}{currencyNames[c] ? ` — ${currencyNames[c]}` : ''}</option>)}
          </select>
          <span className="text-gray-400 text-xs font-mono">→</span>
          <select
            value={target}
            onChange={(e) => selectTargetCurrency(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-emerald-800"
          >
            {currencies.filter(c => c !== base
              && isForecastPairAvailable(supportedPairs, base, c)).map(c => (
                <option key={c} value={c}>{c}{currencyNames[c] ? ` — ${currencyNames[c]}` : ''}</option>
              ))}
          </select>
        </div>
      </div>

      {currencyListError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {currencyListError}
        </p>
      )}

      <section className="card space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Quick calculation</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
            <Calculator size={20} className="text-emerald-700" /> Currency converter
          </h2>
          <p className="mt-1 text-sm text-slate-600">Enter an amount to estimate its value using the latest published daily reference rate. Your selected pair also controls the historical chart and hourly forecast below.</p>
        </div>
        <form onSubmit={convertAmount} className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto_1fr_auto] md:items-end">
          <label className="text-sm font-semibold text-slate-800">
            Amount
            <input
              aria-label="Amount to convert"
              className="input-field mt-1"
              type="number"
              min="0.01"
              step="any"
              value={converterAmount}
              onChange={(event) => setConverterAmount(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From
            <select
              className="input-field mt-1"
              value={base}
              onChange={(event) => selectBaseCurrency(event.target.value)}
            >
                {currencies.map((code) => <option key={code} value={code}>{code}{currencyNames[code] ? ` — ${currencyNames[code]}` : ''}</option>)}
            </select>
          </label>
          <ArrowRightLeft className="mx-auto mb-3 hidden text-slate-400 md:block" size={18} />
          <label className="text-sm font-semibold text-slate-800">
            To
            <select
              className="input-field mt-1"
              value={target}
              onChange={(event) => selectTargetCurrency(event.target.value)}
            >
              {currencies.filter((code) => code !== base
                && isForecastPairAvailable(supportedPairs, base, code)).map((code) => (
                <option key={code} value={code}>{code}{currencyNames[code] ? ` — ${currencyNames[code]}` : ''}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={converting || !canConvert} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {converting ? <Loader2 size={16} className="animate-spin" /> : null}
            Convert
          </button>
        </form>
        {!canConvert && (
          <p role="status" className="text-sm text-amber-800">
            Quick conversion and payment estimates are limited to payment-supported currencies. Forecasts are available for this pair.
          </p>
        )}
        {conversionError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{conversionError}</p>}
        {conversion && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Estimated net payout</p>
                <p className="text-2xl font-bold text-emerald-950">
                  {Number(conversion.finalNetPayout).toLocaleString(undefined, { maximumFractionDigits: conversion.target === 'JPY' ? 0 : 2 })} {conversion.target}
                </p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p>Frankfurter daily reference rate · not a live quote</p>
                <p>Rate date: {conversion.rateDate || (conversion.timestamp ? new Date(conversion.timestamp).toLocaleDateString() : 'unavailable')}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-emerald-200 pt-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-600">Source amount and pair</dt>
                <dd className="font-semibold text-slate-900">{conversion.currencyPair}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Mid-market / quoted rate · FX spread</dt>
                <dd className="font-semibold text-slate-900">{conversion.rate} / {conversion.quotedRate} {conversion.target} per {conversion.base} · {conversion.spreadBps} bps</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Estimated clearing rail / settlement</dt>
                <dd className="font-semibold text-slate-900">{conversion.appliedClearingRail} · {conversion.estimatedSettlementDuration}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Instant feasibility</dt>
                <dd className="font-semibold text-slate-900">
                  {conversion.instantFeasibility}
                  {!conversion.is_instant && conversion.instantIneligibilityReason
                    ? ` — ${conversion.instantIneligibilityReason}`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Estimated rail fee (charged separately)</dt>
                <dd className="font-semibold text-slate-900">{conversion.railFeeEstimateUSD} USD</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Mid-market reference amount</dt>
                <dd className="font-semibold text-slate-900">
                  {Number(conversion.convertedAmount).toLocaleString(undefined, { maximumFractionDigits: conversion.target === 'JPY' ? 0 : 2 })} {conversion.target}
                </dd>
              </div>
            </dl>
          </div>
        )}
        <p className="text-xs text-slate-500">All rails and delivery windows are modeled estimates, not external network integrations or payout guarantees. The displayed rail fee is separate from the net payout; actual provider pricing and delivery may differ.</p>
      </section>

      <FXForecastChart base={base} target={target} />
    </div>
  );
};

export default FXForecasting;
