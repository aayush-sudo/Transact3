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
  Filler,
  Legend,
} from 'chart.js';
import api from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const HistoricalChart = ({ base, setBase, target, setTarget }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [displayMode, setDisplayMode] = useState('Actual Value');

  const timeRangeOptions = [
    { label: '10 Years', value: 3650 },
    { label: '5 Years', value: 1825 },
    { label: '1 Year', value: 365 },
    { label: '6 Months', value: 180 },
    { label: '1 Month', value: 30 },
    { label: '15 Days', value: 15 },
    { label: '7 Days', value: 7 },
    { label: '1 Day', value: 1 }
  ];

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/currency/history?base=${base}&target=${target}&days=${timeRange}`);
      const data = res.data.data;

      if (data.result === 'success') {
        const dates = Object.keys(data.conversion_rates).sort();
        const rates = dates.map(date => data.conversion_rates[date][target]);

        if (rates.length > 0) {
          const latest = rates[rates.length - 1];
          const previous = rates.length > 1 ? rates[rates.length - 2] : latest;
          const change = latest - previous;
          const percent = previous !== 0 ? (change / previous) * 100 : 0;

          setCurrentPrice(latest);
          setPriceChange({ value: change, percent });
        }

        let displayRates = rates;
        if (displayMode === 'Percentage Change (%)' && rates.length > 0) {
          const baseRate = rates[0];
          displayRates = rates.map(r => ((r - baseRate) / baseRate) * 100);
        }

        setChartData({
          labels: dates.map(d => {
            const dateObj = new Date(d);
            if (timeRange > 365) {
              return `${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
            }
            return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
          }),
          datasets: [
            {
              fill: true,
              label: `${base} to ${target}`,
              data: displayRates,
              borderColor: '#C6FF00',
              backgroundColor: 'rgba(198, 255, 0, 0.12)',
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        });
      }
    } catch (err) {
      console.error('Failed to fetch historical data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [base, target, timeRange, displayMode]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1A3A1A',
        titleColor: '#C6FF00',
        bodyColor: '#AEEA00',
        borderColor: '#3D7A3D',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              if (displayMode === 'Actual Value') {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: target, maximumFractionDigits: 4 }).format(context.parsed.y);
              } else {
                label += context.parsed.y.toFixed(2) + '%';
              }
            }
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#888888', font: { size: 11 } },
        border: { display: false }
      },
      y: {
        grid: { color: '#E8E8E4' },
        ticks: {
          color: '#888888',
          font: { size: 11 },
          callback: function(value) {
            if (displayMode === 'Actual Value') {
              return new Intl.NumberFormat('en-US', {
                style: 'currency', currency: target, maximumFractionDigits: 2
              }).format(value);
            } else {
              return value.toFixed(2) + '%';
            }
          }
        },
        border: { display: false }
      },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'];

  return (
    <div className="card h-full min-h-[400px] flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-5 gap-4">
        <div>
          <h3 className="text-base font-bold text-velto-ink mb-0.5">
            Historical Trends <span className="text-velto-muted font-medium text-sm">({timeRangeOptions.find(o => o.value === timeRange)?.label})</span>
          </h3>
          {currentPrice !== null && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-velto-forest">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: target, maximumFractionDigits: 4 }).format(currentPrice)}
              </span>
              {priceChange !== null && (
                <span className={`text-sm font-semibold ${priceChange.value >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {priceChange.value >= 0 ? '+' : ''}{priceChange.value.toFixed(4)} ({priceChange.value >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center">
          <div className="flex bg-velto-surface rounded-xl overflow-hidden border border-velto-surface-dark">
            {['Actual Value', 'Percentage Change (%)'].map(mode => (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${displayMode === mode ? 'bg-velto-forest text-velto-lime' : 'text-velto-muted hover:text-velto-ink'}`}
              >
                {mode === 'Actual Value' ? 'Value' : '% Change'}
              </button>
            ))}
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="bg-velto-surface border border-velto-surface-dark text-velto-ink rounded-xl p-1.5 text-xs font-semibold"
          >
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-grow relative w-full h-full min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-velto-lime" />
          </div>
        ) : chartData ? (
          <Line options={options} data={chartData} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-velto-faint">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalChart;
