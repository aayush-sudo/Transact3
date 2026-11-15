import { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const FXForecastChart = ({ base, target }) => {
  const [historyData, setHistoryData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setHistoryData(null);
    setForecastData(null);
    setError('');
    const [historyResult, forecastResult] = await Promise.allSettled([
      api.post('/fx/history', { baseCurrency: base, targetCurrency: target, days: 365 }),
      api.post('/orchestration/fx-forecast', { sourceCurrency: base, destinationCurrency: target })
    ]);

    const hourlyForecast = forecastResult.status === 'fulfilled'
      ? forecastResult.value.data.data
      : null;
    if (historyResult.status === 'fulfilled') {
      setHistoryData(historyResult.value.data.data);
    } else if (hourlyForecast?.hourlyObservations?.length) {
      console.warn('Daily reference history unavailable; using the forecast provider hourly observations.');
      setHistoryData({
        currentRate: hourlyForecast.currentRate,
        rateDate: hourlyForecast.rateDate,
        source: hourlyForecast.rateSource,
        frequency: 'hourly',
        observations: hourlyForecast.hourlyObservations
      });
    } else {
      console.error('Failed to fetch historical FX rates', historyResult.reason);
      setError(historyResult.reason.response?.data?.message || `Could not load reference-rate history for ${base}/${target}.`);
    }

    if (forecastResult.status === 'fulfilled') {
      setForecastData(forecastResult.value.data.data);
    } else {
      console.error('Failed to fetch ML FX forecast', forecastResult.reason);
      setForecastData({
        forecastAvailable: false,
        forecastUnavailableReason: forecastResult.reason.response?.data?.message || 'The model forecast could not be loaded.'
      });
    }
    setLoading(false);
  }, [base, target]);

  useEffect(() => {
    const initialFetch = setTimeout(fetchData, 0);
    return () => clearTimeout(initialFetch);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-700" />
      </div>
    );
  }

  const hasForecast = forecastData?.forecastAvailable
    && forecastData.currentRate != null
    && Number.isFinite(Number(forecastData.currentRate));
  const observations = historyData?.observations || [];
  const labels = observations.map(({ date }) => historyData?.frequency === 'hourly'
    ? new Date(date).toLocaleString()
    : date);

  const chartData = {
    labels,
    datasets: [
      {
        label: historyData?.frequency === 'hourly'
          ? `${base}/${target} ${historyData.source || 'hourly close'}`
          : `${base}/${target} daily reference rate`,
        data: observations.map(({ rate }) => rate),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.2,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointRadius: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#475569', usePointStyle: true } },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#047857',
        bodyColor: '#334155',
        borderColor: '#cbd5e1',
        borderWidth: 1
      }
    },
    scales: {
      x: { grid: { color: 'rgba(148, 163, 184, 0.25)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.25)' }, ticks: { color: '#64748b' } }
    }
  };

  const horizons = [
    { key: '+6h', label: 'Next 6 hours' },
    { key: '+12h', label: 'Next 12 hours' },
    { key: '+24h', label: 'Next 24 hours' },
    { key: '+48h', label: 'Next 48 hours' }
  ];
  const displayRate = (hasForecast ? forecastData.currentRate : historyData?.currentRate) ?? 'N/A';

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">FX model outlook</span>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">
            {base}/{target} · {historyData?.frequency === 'hourly' ? 'hourly provider history' : 'daily reference history'} and hourly outlook
          </h3>
        </div>
        <div className="text-right font-mono">
          <span className="text-xl font-extrabold text-slate-900">1 {base} = {displayRate} {target}</span>
          <p className="text-xs text-slate-500">
            {hasForecast ? `${forecastData.rateSource} · ${forecastData.rateDate || 'timestamp unavailable'}` : `Daily reference · ${historyData.rateDate || 'date unavailable'}`}
          </p>
        </div>
      </div>

      {observations.length ? (
        <div className="h-[260px] w-full">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div role={error ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm ${error ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
          {error || `No historical reference rates are available for ${base}/${target}.`}
        </div>
      )}

      {hasForecast ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-700">Hourly FX forecast</span>
              <p className="text-xs text-slate-600">{forecastData.forecastProvider} · rates shown per 1 {base}</p>
            </div>
            {forecastData.forecastSource === 'mock' && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                Demo data — not a live market forecast
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {horizons.map(({ key, label }) => {
              const prediction = forecastData.predictions?.[key];
              return (
                <div key={key} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <span className="block text-xs text-indigo-800">{label}</span>
                  <span className="font-mono text-lg font-bold text-indigo-950">
                    {prediction?.rate == null
                      ? 'Unavailable'
                      : Number(prediction.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    {' '}{target}
                  </span>
                  {prediction?.low != null && prediction?.high != null && (
                    <span className="mt-1 block text-xs text-indigo-800">
                      Approx. range: {Number(prediction.low).toLocaleString(undefined, { maximumFractionDigits: 6 })}–{Number(prediction.high).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            {forecastData.predictionInterval?.note || 'Ranges are approximate and are not calibrated confidence intervals.'}
            {' '}Forecasts are experimental and are not executable quotes or payment advice.
          </p>
        </div>
      ) : (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {forecastData?.forecastUnavailableReason || 'The hourly FX forecaster did not return a forecast.'}
        </div>
      )}

      <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600">
        Historical chart: {historyData?.frequency === 'hourly'
          ? `${historyData.source || 'Hourly provider'} observations`
          : 'Frankfurter dated daily reference rates'}. Forecast source: {forecastData?.rateSource || 'hourly forecast service'}.
        {forecastData?.forecastSource === 'mock' ? ' The service is using synthetic fallback data because Twelve Data is not configured.' : ''}
        {' '}Hourly estimates can differ from daily reference rates and other indicative sources; they are not executable quotes.
      </p>
    </div>
  );
};

export default FXForecastChart;
