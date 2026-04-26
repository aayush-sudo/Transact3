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
              borderColor: '#10b981', // fintech-primary
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
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
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
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
        grid: {
          display: false,
          color: '#334155',
        },
        ticks: {
          color: '#94a3b8',
        }
      },
      y: {
        grid: {
          color: '#1e293b',
        },
        ticks: {
          color: '#94a3b8',
          callback: function(value) {
            if (displayMode === 'Actual Value') {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: target,
                maximumFractionDigits: 2
              }).format(value);
            } else {
              return value.toFixed(2) + '%';
            }
          }
        }
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'];

  return (
    <div className="card h-full min-h-[400px] flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            Historical Trends ({timeRangeOptions.find(o => o.value === timeRange)?.label})
          </h3>
          {currentPrice !== null && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-fintech-primary">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: target, maximumFractionDigits: 4 }).format(currentPrice)}
              </span>
              {priceChange !== null && (
                <span className={`text-sm font-medium ${priceChange.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceChange.value >= 0 ? '+' : ''}{priceChange.value.toFixed(4)} ({priceChange.value >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
          <div className="flex bg-fintech-darker rounded overflow-hidden border border-slate-700">
            {['Actual Value', 'Percentage Change (%)'].map(mode => (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${displayMode === mode ? 'bg-fintech-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {mode === 'Actual Value' ? 'Value' : '% Change'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="bg-fintech-darker border border-slate-700 text-white rounded p-1 text-sm"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex-grow relative w-full h-full min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fintech-primary"></div>
          </div>
        ) : chartData ? (
          <Line options={options} data={chartData} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalChart;
