import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Landmark, ShieldCheck } from 'lucide-react';

const WalletSection = () => {
  const { user, institutionBalance = 250000 } = useContext(AuthContext);

  const institutionName = user?.name ? `${user.name} (Treasury)` : 'Global Settlement Corp';

  return (
    <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 border border-gray-700/60 shadow-xl space-y-3 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Landmark size={18} />
          </div>
          <h3 className="text-sm font-bold text-white">Institutional Treasury Pool</h3>
        </div>
        <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30">
          <ShieldCheck size={11} />
          VERIFIED LIQUIDITY
        </div>
      </div>

      <div>
        <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider mb-1">Available Clearing Capital</p>
        <p className="text-3xl font-black text-white">
          ${institutionBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/40 text-xs flex justify-between items-center">
        <span className="text-gray-400 font-semibold">Operating Institution</span>
        <span className="text-emerald-400 font-bold font-mono">{institutionName}</span>
      </div>
    </div>
  );
};

export default WalletSection;
