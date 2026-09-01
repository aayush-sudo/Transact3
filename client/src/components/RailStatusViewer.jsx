import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../services/api';

const RailStatusViewer = () => {
  const [railStatus, setRailStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRailsStatus();
    const interval = setInterval(fetchRailsStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchRailsStatus = async () => {
    try {
      const { data } = await api.get('/orchestration/rails');
      setRailStatus(data.data);
    } catch (err) {
      console.error('Failed to fetch rails status', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/60 flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  const rails = railStatus ? Object.values(railStatus.rails) : [];

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Multi-Rail Liquidity & Settlement Capacity Monitor</h3>
            <p className="text-xs text-gray-400">Real-time throughput and utilization across 6 simulated settlement pipelines</p>
          </div>
        </div>

        <button onClick={fetchRailsStatus} className="p-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rails.map((rail) => {
          const utilPct = rail.utilizationPct;
          let utilColor = 'bg-emerald-500';
          let textColor = 'text-emerald-400';

          if (utilPct >= 90) {
            utilColor = 'bg-rose-500';
            textColor = 'text-rose-400';
          } else if (utilPct >= 85) {
            utilColor = 'bg-amber-500';
            textColor = 'text-amber-400';
          }

          return (
            <div key={rail.railId} className="bg-gray-900/60 rounded-xl p-3.5 border border-gray-700/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-200">{rail.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${utilPct >= 85 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {rail.status}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-gray-400">Capacity Utilized</span>
                  <span className={`font-bold ${textColor}`}>{utilPct}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className={`${utilColor} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${utilPct}%` }} />
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-gray-400 font-mono pt-1">
                <span>Dynamic Penalty: {rail.liquidityPenalty > 0 ? `+${rail.liquidityPenalty}` : '0.00'}</span>
                <span>Hourly Cap: ${(rail.hourlyCapacityUSD / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RailStatusViewer;
