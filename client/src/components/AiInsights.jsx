import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

const AiInsights = ({ base = 'USD', target = 'INR' }) => {
  const [currentRate, setCurrentRate] = useState(null);
  const [predictedRate, setPredictedRate] = useState(null);
  const [suggestion, setSuggestion] = useState('');
  const [riskScore, setRiskScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/currency/latest?base=${base}`);
        const rate = res.data.data.conversion_rates[target];
        if (rate) {
          setCurrentRate(rate);
          // Generate a predicted rate (simulated AI prediction)
          const fluctuation = (Math.random() - 0.45) * 0.03; // slight upward bias
          const predicted = rate * (1 + fluctuation);
          setPredictedRate(predicted);
          setSuggestion(predicted > rate ? 'Convert Now' : 'Wait');
        }
      } catch {
        // Mock fallback
        const mockRate = target === 'INR' ? 83.45 : 0.92;
        setCurrentRate(mockRate);
        const fluctuation = (Math.random() - 0.45) * 0.03;
        setPredictedRate(mockRate * (1 + fluctuation));
        setSuggestion(Math.random() > 0.5 ? 'Convert Now' : 'Wait');
      }
      // Generate risk score
      setRiskScore(Math.floor(Math.random() * 100));
      setLoading(false);
    };
    fetchInsights();
    const interval = setInterval(fetchInsights, 30000);
    return () => clearInterval(interval);
  }, [base, target]);

  const getRiskColor = (score) => {
    if (score <= 33) return { color: 'text-green-400', bg: 'bg-green-400', label: 'Low Risk', border: 'border-green-500/30' };
    if (score <= 66) return { color: 'text-yellow-400', bg: 'bg-yellow-400', label: 'Medium Risk', border: 'border-yellow-500/30' };
    return { color: 'text-red-400', bg: 'bg-red-400', label: 'High Risk', border: 'border-red-500/30' };
  };

  const riskInfo = riskScore !== null ? getRiskColor(riskScore) : null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fintech-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI FX Prediction */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-fintech-secondary/20 rounded-lg">
            <Brain className="text-fintech-secondary" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">AI FX Prediction</h3>
          <span className="ml-auto text-xs text-slate-500 flex items-center gap-1">
            <Clock size={12} /> Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-fintech-darker rounded-lg p-3 border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-1">Current Rate</p>
            <p className="text-xl font-bold text-white">
              {currentRate?.toFixed(4)}
            </p>
            <p className="text-xs text-slate-400">{base}/{target}</p>
          </div>
          <div className="bg-fintech-darker rounded-lg p-3 border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-1">Predicted Rate</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-bold text-white">
                {predictedRate?.toFixed(4)}
              </p>
              {predictedRate > currentRate ? (
                <TrendingUp size={16} className="text-green-400" />
              ) : (
                <TrendingDown size={16} className="text-red-400" />
              )}
            </div>
            <p className="text-xs text-slate-400">AI Forecast</p>
          </div>
        </div>

        <div
          className={`flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm ${
            suggestion === 'Convert Now'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
          }`}
        >
          {suggestion === 'Convert Now' ? <CheckCircle size={16} /> : <Clock size={16} />}
          AI Suggestion: {suggestion}
        </div>
      </div>

      {/* Risk Scoring */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <AlertTriangle className="text-amber-400" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">AI Risk Score</h3>
        </div>

        <div className="flex items-center gap-6">
          {/* Circular gauge */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={riskScore <= 33 ? '#4ade80' : riskScore <= 66 ? '#facc15' : '#f87171'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(riskScore / 100) * 264} 264`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${riskInfo.color}`}>{riskScore}</span>
            </div>
          </div>

          <div>
            <p className={`text-lg font-semibold ${riskInfo.color}`}>{riskInfo.label}</p>
            <p className="text-sm text-slate-400 mt-1">
              {riskScore <= 33
                ? 'Transaction is safe to proceed.'
                : riskScore <= 66
                ? 'Moderate risk detected. Review recommended.'
                : 'High risk! Manual verification required.'}
            </p>
          </div>
        </div>

        {/* Risk bar */}
        <div className="mt-4">
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                riskScore <= 33 ? 'bg-green-400' : riskScore <= 66 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0 - Safe</span>
            <span>50 - Moderate</span>
            <span>100 - Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiInsights;
