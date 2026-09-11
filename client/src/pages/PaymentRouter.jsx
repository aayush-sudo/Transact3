import React, { useState } from 'react';
import MultiRailRouter from '../components/MultiRailRouter';
import RailStatusViewer from '../components/RailStatusViewer';
import { Send, ShieldCheck, Zap } from 'lucide-react';

const PaymentRouter = () => {
  const [lastTransaction, setLastTransaction] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-gray-800 pb-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1 font-mono">
            DYNAMIC PAYMENT ORCHESTRATION & ROUTING ENGINE
          </p>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Send className="text-emerald-400" size={26} />
            Payment Router
          </h1>
        </div>
      </div>

      {/* Main Multi-Rail Router Engine */}
      <MultiRailRouter onTransactionComplete={(tx) => setLastTransaction(tx)} />

      {/* Live 5-Rail Capacity & Status Viewer */}
      <div className="pt-4">
        <RailStatusViewer />
      </div>
    </div>
  );
};

export default PaymentRouter;
