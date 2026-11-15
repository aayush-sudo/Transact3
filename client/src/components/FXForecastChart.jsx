import { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import api from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const FXForecastChart = ({ base, target }) => {
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setHistoryData(null);
    setError('');
    try {
      const { data } = await api.post('/fx/history', {
        baseCurrency: base,
        targetCurrency: target,
        days: 30
      });
      setHistoryData(data.data);
    } catch (err) {
      console.error('Failed to fetch historical FX rates', err);
      setError(err.response?.data?.message || `Could not load reference-rate history for ${base}/${target}.`);
    } finally {
      setLoading(false);
    }
  }, [base, target]);

  useEffect(() => {
    const initialFetch = setTimeout(fetchHistory, 0);
    return () => clearTimeout(initialFetch);
  }, [fetchHistory]);

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

  const chartData = {
    labels: historyData.observations.map(({ date }) => date),
    datasets: [
      {
        label: `${base}/${target} daily reference rate`,
        data: historyData.observations.map(({ rate }) => rate),
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
      legend: { display: false },
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

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Historical reference rates</span>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">{base}/{target} · last 30 days</h3>
        </div>
        <div className="text-right font-mono">
          <span className="text-xl font-extrabold text-slate-900">1 {base} = {historyData.currentRate} {target}</span>
          <p className="text-xs text-slate-500">Reference rate dated {historyData.rateDate || 'date unavailable'}</p>
        </div>
      </div>

      <div className="h-[220px] w-full">
        <Line data={chartData} options={chartOptions} />
      </div>

      <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600">
        Source: Frankfurter daily reference rates. These are historical observations, not live executable quotes.
        No independently validated forecast provider is connected, so future-rate predictions and confidence scores are not shown.
        Google may show a different, more frequently updated indicative rate.
      </p>
    </div>
  );
};

export default FXForecastChart;
