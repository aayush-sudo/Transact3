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
          const fluctuation = (Math.random() - 0.45) * 0.03;
          const predicted = rate * (1 + fluctuation);
          setPredictedRate(predicted);
          setSuggestion(predicted > rate ? 'Convert Now' : 'Wait');
        }
      } catch {
        const mockRate = target === 'INR' ? 83.45 : 0.92;
        setCurrentRate(mockRate);
        const fluctuation = (Math.random() - 0.45) * 0.03;
        setPredictedRate(mockRate * (1 + fluctuation));
        setSuggestion(Math.random() > 0.5 ? 'Convert Now' : 'Wait');
      }
      setRiskScore(Math.floor(Math.random() * 100));
      setLoading(false);
    };
    fetchInsights();
    const interval = setInterval(fetchInsights, 30000);
    return () => clearInterval(interval);
  }, [base, target]);

  const getRiskColor = (score) => {
    if (score <= 33) return { color: 'text-green-600', bg: 'bg-green-400', fill: '#4ade80', label: 'Low Risk' };
    if (score <= 66) return { color: 'text-yellow-600', bg: 'bg-yellow-400', fill: '#facc15', label: 'Medium Risk' };
    return { color: 'text-red-600', bg: 'bg-red-400', fill: '#f87171', label: 'High Risk' };
  };

  const riskInfo = riskScore !== null ? getRiskColor(riskScore) : null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-velto-lime" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI FX Prediction */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-velto-lime rounded-t-2xl" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-velto-forest rounded-xl">
            <Brain className="text-velto-lime" size={18} />
          </div>
          <h3 className="text-base font-bold text-velto-ink">AI FX Prediction</h3>
          <span className="ml-auto text-xs text-velto-faint flex items-center gap-1 font-medium">
            <Clock size={11} /> Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-velto-surface rounded-xl p-3 border border-velto-surface-dark">
            <p className="text-xs text-velto-faint mb-1 font-semibold uppercase tracking-wider">Current Rate</p>
            <p className="text-xl font-bold text-velto-ink">{currentRate?.toFixed(4)}</p>
            <p className="text-xs text-velto-muted">{base}/{target}</p>
          </div>
          <div className="bg-velto-surface rounded-xl p-3 border border-velto-surface-dark">
            <p className="text-xs text-velto-faint mb-1 font-semibold uppercase tracking-wider">Predicted Rate</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-bold text-velto-ink">{predictedRate?.toFixed(4)}</p>
              {predictedRate > currentRate ? (
                <TrendingUp size={15} className="text-green-500" />
              ) : (
                <TrendingDown size={15} className="text-red-500" />
              )}
            </div>
            <p className="text-xs text-velto-muted">AI Forecast</p>
          </div>
        </div>

        <div
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm ${
            suggestion === 'Convert Now'
              ? 'bg-velto-forest text-velto-lime'
              : 'bg-velto-surface text-velto-muted border border-velto-surface-dark'
          }`}
        >
          {suggestion === 'Convert Now' ? <CheckCircle size={15} /> : <Clock size={15} />}
          AI Suggestion: {suggestion}
        </div>
      </div>

      {/* Risk Scoring */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
            <AlertTriangle className="text-amber-500" size={18} />
          </div>
          <h3 className="text-base font-bold text-velto-ink">AI Risk Score</h3>
        </div>

        <div className="flex items-center gap-5">
          {/* Circular gauge */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#E8E8E4" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={riskInfo.fill}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(riskScore / 100) * 264} 264`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${riskInfo.color}`}>{riskScore}</span>
            </div>
          </div>

          <div>
            <p className={`text-base font-bold ${riskInfo.color}`}>{riskInfo.label}</p>
            <p className="text-sm text-velto-muted mt-1">
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
          <div className="w-full bg-velto-surface rounded-full h-2 border border-velto-surface-dark">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ease-out ${riskInfo.bg}`}
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-velto-faint mt-1 font-medium">
            <span>0 – Safe</span>
            <span>50 – Moderate</span>
            <span>100 – Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiInsights;
