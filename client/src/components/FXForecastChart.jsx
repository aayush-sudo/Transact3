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

    if (historyResult.status === 'fulfilled') {
      setHistoryData(historyResult.value.data.data);
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

  if (error) {
    return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;
  }

  if (!historyData?.observations?.length) {
    return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">No historical reference rates are available for {base}/{target}.</div>;
  }

  const hasForecast = forecastData?.forecastAvailable
    && forecastData.forecastRate != null
    && Number.isFinite(Number(forecastData.forecastRate));
  const lastObservation = historyData.observations.at(-1);
  const forecastDate = lastObservation
    ? new Date(new Date(`${lastObservation.date}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;
  const labels = historyData.observations.map(({ date }) => date);
  if (hasForecast && forecastDate) labels.push(forecastDate);

  const chartData = {
    labels,
    datasets: [
      {
        label: `${base}/${target} daily reference rate`,
        data: [...historyData.observations.map(({ rate }) => rate), ...(hasForecast ? [null] : [])],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.2,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointRadius: 2
      },
      ...(hasForecast ? [{
        label: 'ML next-observation estimate',
        data: [
          ...historyData.observations.slice(0, -1).map(() => null),
          lastObservation.rate,
          forecastData.forecastRate
        ],
        borderColor: '#6366f1',
        backgroundColor: '#6366f1',
        borderDash: [6, 4],
        tension: 0,
        fill: false,
        pointRadius: 4,
        pointBackgroundColor: '#6366f1'
      }] : [])
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

  const validation = forecastData?.historicalValidation;
  const interval = forecastData?.predictionInterval;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">FX model outlook</span>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">{base}/{target} · daily reference history</h3>
        </div>
        <div className="text-right font-mono">
          <span className="text-xl font-extrabold text-slate-900">1 {base} = {historyData.currentRate} {target}</span>
          <p className="text-xs text-slate-500">Reference rate dated {historyData.rateDate || 'date unavailable'}</p>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <Line data={chartData} options={chartOptions} />
      </div>

      {hasForecast ? (
        <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <span className="block text-xs text-indigo-800">Model estimate · next daily observation</span>
            <span className="font-mono text-lg font-bold text-indigo-950">
              1 {base} = {Number(forecastData.forecastRate).toLocaleString(undefined, { maximumFractionDigits: 6 })} {target}
            </span>
            <span className="block text-xs text-indigo-800">
              {forecastData.forecastReturnPct >= 0 ? '+' : ''}{forecastData.forecastReturnPct}% vs. latest
            </span>
            {interval?.lowerBound != null && interval?.upperBound != null && (
              <span className="mt-1 block text-xs text-indigo-800">
                {interval.confidenceLevel}: {interval.lowerBound}–{interval.upperBound}
              </span>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="block text-xs text-slate-600">Historical direction accuracy (confidence proxy)</span>
            <span className="font-mono text-lg font-bold text-slate-900">
              {forecastData.confidencePct == null ? 'Not available' : `${forecastData.confidencePct}%`}
            </span>
            <span className="block text-xs text-slate-600">
              {validation?.observations || 0} rolling tests; not a calibrated probability
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="block text-xs text-slate-600">Return MAE · model vs. no-change baseline</span>
            <span className="font-mono text-sm font-bold text-slate-900">
              {validation?.maePct ?? 'N/A'}% / {validation?.baselineMaePct ?? 'N/A'}%
            </span>
            <span className="block text-xs text-slate-600">Out-of-sample, actual daily observations</span>
          </div>
          <div className={`rounded-xl border p-3 ${validation?.reliability_gate_passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <span className="block text-xs text-slate-700">Reliability check</span>
            <span className="font-semibold text-slate-900">
              {validation?.reliabilityGatePassed ? 'Passed' : 'Not reliable for timing'}
            </span>
            <span className="block text-xs text-slate-700">
              {validation?.directionalAccuracyInterval95Pct
                ? `95% accuracy interval: ${validation.directionalAccuracyInterval95Pct[0]}–${validation.directionalAccuracyInterval95Pct[1]}%`
                : 'Insufficient historical tests'}
            </span>
          </div>
        </div>
      ) : (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {forecastData?.forecastUnavailableReason || 'The trained FX model did not return a forecast.'}
        </div>
      )}

      <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600">
        Source: Frankfurter dated daily reference rates. The saved {forecastData?.forecastProvider || 'HistGradientBoosting'} model estimates the next daily observation.
        {forecastData?.modelTrainingDataThrough ? ` Model training data through ${forecastData.modelTrainingDataThrough}.` : ''}
        Confidence proxy is historical directional accuracy, not a calibrated probability. The 95% Wilson interval describes uncertainty in that hit rate; the separate 90% band summarizes historical absolute rate errors.
        Model estimates are experimental, not executable quotes or payment advice. Google may show a different, more frequently updated indicative rate.
      </p>
    </div>
  );
};

export default FXForecastChart;
