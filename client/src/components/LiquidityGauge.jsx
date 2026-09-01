import React from 'react';
import { DollarSign, Percent } from 'lucide-react';

const LiquidityGauge = ({ label, percentage, amountFormatted, status }) => {
  let color = 'text-emerald-400 bg-emerald-500';
  if (percentage >= 90) color = 'text-rose-400 bg-rose-500';
  else if (percentage >= 85) color = 'text-amber-400 bg-amber-500';

  return (
    <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/40 space-y-1.5 font-mono">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-gray-200">{label}</span>
        <span className="text-[10px] text-gray-400">{status || 'ACTIVE'}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-bold text-white">{amountFormatted}</span>
        <span className={`text-xs font-bold ${color.split(' ')[0]}`}>{percentage}% Util</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className={`${color.split(' ')[1]} h-1.5 rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

export default LiquidityGauge;
