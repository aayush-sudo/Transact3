import React from 'react';
import RailStatusViewer from '../components/RailStatusViewer';

const Liquidity = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
          REAL-TIME SETTLEMENT POOL MONITORING
        </p>
        <h1 className="text-3xl font-extrabold text-white">Liquidity & Capacity Management</h1>
      </div>

      <RailStatusViewer />
    </div>
  );
};

export default Liquidity;
