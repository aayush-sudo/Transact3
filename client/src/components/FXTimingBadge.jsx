import React from 'react';
import { Clock, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

const FXTimingBadge = ({ timing }) => {
  if (!timing) return null;

  const isExecuteNow = timing.recommendation === 'EXECUTE_NOW';
  const isDefer = timing.recommendation?.startsWith('DEFER');

  return (
    <div
      className={`rounded-xl p-3.5 border transition-all ${
        isExecuteNow
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isExecuteNow ? (
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <Zap size={16} className="text-amber-400" />
            </div>
          ) : (
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">FX Conversion Timing</span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                  isExecuteNow ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-400/20 text-emerald-300 font-mono'
                }`}
              >
                {timing.recommendation?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs opacity-90 mt-1">{timing.reason}</p>
          </div>
        </div>

        {isDefer && timing.expectedSavingsPct > 0 && (
          <div className="text-right">
            <span className="text-xs font-bold text-emerald-400 font-mono">+ {timing.expectedSavingsPct}% Yield</span>
            <p className="text-[10px] text-gray-400 font-mono">Forecast Savings</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FXTimingBadge;
