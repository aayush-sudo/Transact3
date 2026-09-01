import React from 'react';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';

const STAGES = [
  'INITIATED',
  'VALIDATED',
  'QUOTED',
  'AUTHORIZED',
  'FX_EXECUTED',
  'RAIL_SELECTED',
  'LIQUIDITY_RESERVED',
  'SETTLED',
  'COMPLETED'
];

const TransactionTimeline = ({ currentStatus = 'COMPLETED' }) => {
  const currentIndex = STAGES.indexOf(currentStatus) !== -1 ? STAGES.indexOf(currentStatus) : STAGES.length - 1;

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 border border-gray-700/60 space-y-3">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Transaction State Machine Lifecycle</h4>
      
      <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
        {STAGES.map((stage, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div
              key={stage}
              className={`p-2 rounded-lg text-center transition-all border font-mono ${
                isDone
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-gray-900/40 border-gray-700/30 text-gray-500'
              }`}
            >
              <div className="flex justify-center mb-1">
                {isDone ? (
                  <CheckCircle2 size={13} className="text-emerald-400" />
                ) : (
                  <Clock size={13} className="text-gray-500" />
                )}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tighter block truncate">{stage.replace('_', ' ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionTimeline;
