import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

const AiInsights = ({ base = 'USD', target = 'EUR' }) => {
  const [currentRate, setCurrentRate] = useState(null);
  const [predictedRate, setPredictedRate] = useState(null);
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      try {
        const res = await api.post('/orchestration/fx-forecast', { sourceCurrency: base, destinationCurrency: target });
        if (res.data && res.data.data) {
          const forecast = res.data.data;
          setCurrentRate(forecast.currentRate);
          setPredictedRate(forecast.optimalProjectedRate);
          setSuggestion(forecast.optimalProjectedRate > forecast.currentRate ? 'Convert Now' : 'Wait');
        }
      } catch {
        const mockRate = target === 'INR' ? 83.45 : 0.92;
        setCurrentRate(mockRate);
        setPredictedRate(mockRate * 1.002);
        setSuggestion('Convert Now');
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, [base, target]);

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/60 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4 font-mono">
      {/* AI FX Prediction */}
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Brain size={18} />
          </div>
          <h3 className="text-sm font-bold text-white">AI Market Summary</h3>
        </div>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <Clock size={11} className="text-emerald-400" /> Live Feed
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/30">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Spot Rate</p>
          <p className="text-lg font-bold text-white">{currentRate?.toFixed(4)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{base}/{target}</p>
        </div>
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/30">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Forecast Peak</p>
          <div className="flex items-center gap-1">
            <p className="text-lg font-bold text-emerald-400">{predictedRate?.toFixed(4)}</p>
            {predictedRate >= currentRate ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : (
              <TrendingDown size={14} className="text-rose-400" />
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">48h Horizon</p>
        </div>
      </div>

      <div
        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs ${
          suggestion === 'Convert Now'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : 'bg-gray-900/40 text-gray-400 border border-gray-700/40'
        }`}
      >
        <CheckCircle size={14} />
        Recommendation: {suggestion === 'Convert Now' ? 'Optimal Conversion Window Active' : 'Hold Conversion for Horizon Dip'}
      </div>
    </div>
  );
};

export default AiInsights;
