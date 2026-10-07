import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import api from '../services/api';

const RailStatusViewer = () => {
  const [railStatus, setRailStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRailsStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/orchestration/rails');
      setRailStatus(data.data);
    } catch (err) {
      console.error('Failed to fetch rails status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = setTimeout(fetchRailsStatus, 0);
    window.addEventListener('transact3:capacity-changed', fetchRailsStatus);
    return () => {
      clearTimeout(initialFetch);
      window.removeEventListener('transact3:capacity-changed', fetchRailsStatus);
    };
  }, [fetchRailsStatus]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  const rails = Array.isArray(railStatus) ? railStatus : [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Route capacity estimates</h3>
            <p className="text-xs text-slate-500">Available capacity across three modeled route options</p>
          </div>
        </div>

        <button onClick={fetchRailsStatus} aria-label="Refresh route capacity" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-colors hover:bg-slate-200">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rails.map((rail) => {
          const capacityUSD = Math.max(0, Number(rail.initialLiquidityUSD) || 0);
          const availableUSD = Math.max(0, Number(rail.availableLiquidityUSD) || 0);
          const utilPct = capacityUSD > 0
            ? Math.min(100, Math.round(((capacityUSD - availableUSD) / capacityUSD) * 100))
            : 0;
          const status = !rail.isEnabled ? 'DISABLED' : utilPct >= 90 ? 'LOW LIQUIDITY' : 'ACTIVE';
          let utilColor = 'bg-emerald-500';
          let textColor = 'text-emerald-400';
          let statusColor = 'bg-emerald-500/20 text-emerald-300';

          if (!rail.isEnabled || utilPct >= 90) {
            utilColor = 'bg-rose-500';
            textColor = 'text-rose-400';
            statusColor = 'bg-rose-500/20 text-rose-300';
          } else if (utilPct >= 85) {
            utilColor = 'bg-amber-500';
            textColor = 'text-amber-400';
            statusColor = 'bg-amber-500/20 text-amber-300';
          }

          return (
            <div key={rail.railId} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{rail.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${statusColor}`}>
                  {status}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500">Capacity utilized</span>
                  <span className={`font-bold ${textColor}`}>{utilPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`${utilColor} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${utilPct}%` }} />
                </div>
              </div>

              <div className="flex justify-between pt-1 font-mono text-[11px] text-slate-500">
                <span>Available: ${availableUSD.toLocaleString()}</span>
                <span>Pool: ${capacityUSD.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RailStatusViewer;
