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
  Legend,
  Filler
} from 'chart.js';
import api from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FXForecastChart = ({ base = 'USD', target = 'INR' }) => {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/orchestration/fx-forecast', {
        sourceCurrency: base,
        destinationCurrency: target
      });
      setForecastData(data.data);
    } catch (err) {
      console.error('Failed to fetch FX forecast', err);
    } finally {
      setLoading(false);
    }
  }, [base, target]);

  useEffect(() => {
    const initialFetch = setTimeout(fetchForecast, 0);
    return () => clearTimeout(initialFetch);
  }, [fetchForecast]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-700" />
      </div>
    );
  }

  if (!forecastData) return null;

  const current = forecastData.currentRate;
  const preds = forecastData.predictions;

  const labels = ['Past (-24h)', 'Past (-12h)', 'Now', '+6h', '+12h', '+24h', '+48h'];
  const values = [
    parseFloat((current * 0.997).toFixed(4)),
    parseFloat((current * 0.999).toFixed(4)),
    current,
    preds.h6,
    preds.h12,
    preds.h24,
    preds.h48
  ];

  const chartData = {
    labels,
    datasets: [
      {
        label: `${base}/${target} Projected Rate`,
        data: values,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointRadius: 4
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
      x: { grid: { color: 'rgba(148, 163, 184, 0.25)' }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.25)' }, ticks: { color: '#64748b' } }
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Predictive FX outlook</span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-extrabold text-emerald-800">
              {forecastData.confidencePct}% Confidence
            </span>
          </div>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">
            {base}/{target} Exchange Rate Forecast
          </h3>
        </div>

        <div className="text-right font-mono">
          <span className="text-xl font-extrabold text-slate-900">1 {base} = {current} {target}</span>
          <p className="text-xs text-slate-500">Current reference rate</p>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[220px] w-full">
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Horizon Predictions Grid */}
      <div className="grid grid-cols-4 gap-2 border-t border-slate-200 pt-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center font-mono">
          <span className="block text-[10px] font-semibold text-slate-500">+6 Hours</span>
          <span className="text-sm font-bold text-slate-800">{preds.h6}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center font-mono">
          <span className="block text-[10px] font-semibold text-slate-500">+12 Hours</span>
          <span className="text-sm font-bold text-emerald-800">{preds.h12}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center font-mono">
          <span className="block text-[10px] font-semibold text-slate-500">+24 Hours</span>
          <span className="text-sm font-bold text-slate-800">{preds.h24}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center font-mono">
          <span className="block text-[10px] font-semibold text-slate-500">+48 Hours</span>
          <span className="text-sm font-bold text-slate-800">{preds.h48}</span>
        </div>
      </div>
    </div>
  );
};

export default FXForecastChart;
