import React from 'react';
import { CheckCircle2, Globe, Zap, Activity, ShieldCheck, Repeat, CreditCard } from 'lucide-react';

const ICON_MAP = {
  Globe: Globe,
  Zap: Zap,
  Activity: Activity,
  ShieldCheck: ShieldCheck,
  Repeat: Repeat,
  CreditCard: CreditCard
};

const RailRanking = ({ rails, selectedRailId, onSelectRail }) => {
  if (!rails || rails.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Multi-Rail Optimization Ranking</h4>
        <span className="text-[11px] text-emerald-400 font-mono font-medium">Ranked by Joint Utility Function</span>
      </div>

      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {rails.map((rail, index) => {
          const isSelected = selectedRailId ? selectedRailId === rail.id : index === 0;
          const IconComponent = ICON_MAP[rail.icon] || Globe;

          return (
            <div
              key={rail.id}
              onClick={() => onSelectRail && onSelectRail(rail.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : 'bg-gray-800/40 border-gray-700/40 hover:border-gray-600/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/40 text-gray-400'}`}>
                    <IconComponent size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{rail.name}</span>
                      {index === 0 && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono">
                          AI TOP ROUTE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      Fee: ${rail.estFeeUSD} · Est. Latency: {rail.estLatencyHours}h · Reliability: {Math.round(rail.reliabilityScore * 100)}%
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-gray-200 font-mono">
                    Score: {rail.utilityScore}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Util: {rail.liquidityUtilPct}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RailRanking;
