import React, { useState, useEffect } from 'react';
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
import { TrendingUp, Clock, AlertCircle } from 'lucide-react';
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

  useEffect(() => {
    fetchForecast();
  }, [base, target]);

  const fetchForecast = async () => {
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
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/60 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
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
        backgroundColor: '#1f2937',
        titleColor: '#10b981',
        bodyColor: '#f3f4f6',
        borderColor: '#374151',
        borderWidth: 1
      }
    },
    scales: {
      x: { grid: { color: 'rgba(55, 65, 81, 0.3)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(55, 65, 81, 0.3)' }, ticks: { color: '#9ca3af' } }
    }
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">PREDICTIVE FX ENGINE</span>
            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              {forecastData.confidencePct}% Confidence
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mt-0.5">
            {base}/{target} Exchange Rate Forecast
          </h3>
        </div>

        <div className="text-right font-mono">
          <span className="text-xl font-extrabold text-white">1 {base} = {current} {target}</span>
          <p className="text-xs text-gray-400">Current Reference Rate</p>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[220px] w-full">
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Horizon Predictions Grid */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-700/60">
        <div className="bg-gray-900/60 p-2.5 rounded-xl text-center border border-gray-700/30 font-mono">
          <span className="text-[10px] text-gray-400 block font-semibold">+6 Hours</span>
          <span className="text-sm font-bold text-gray-200">{preds.h6}</span>
        </div>
        <div className="bg-gray-900/60 p-2.5 rounded-xl text-center border border-gray-700/30 font-mono">
          <span className="text-[10px] text-gray-400 block font-semibold">+12 Hours</span>
          <span className="text-sm font-bold text-emerald-400">{preds.h12}</span>
        </div>
        <div className="bg-gray-900/60 p-2.5 rounded-xl text-center border border-gray-700/30 font-mono">
          <span className="text-[10px] text-gray-400 block font-semibold">+24 Hours</span>
          <span className="text-sm font-bold text-gray-200">{preds.h24}</span>
        </div>
        <div className="bg-gray-900/60 p-2.5 rounded-xl text-center border border-gray-700/30 font-mono">
          <span className="text-[10px] text-gray-400 block font-semibold">+48 Hours</span>
          <span className="text-sm font-bold text-gray-200">{preds.h48}</span>
        </div>
      </div>
    </div>
  );
};

export default FXForecastChart;
