import MultiRailRouter from '../components/MultiRailRouter';
import RailStatusViewer from '../components/RailStatusViewer';
import { ArrowLeftRight, Info } from 'lucide-react';

const PaymentRouter = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-gray-200 pb-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-1">
            INDEPENDENT TRANSFER PLANNING
          </p>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ArrowLeftRight className="text-emerald-700" size={26} />
            Compare transfer options
          </h1>
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <Info size={18} className="mt-0.5 shrink-0 text-sky-700" />
        <p>
          Explore estimated rates, fees, delivery times, and route trade-offs before choosing a provider. Transact3 is an information and comparison platform, not a payment processor. Simulated transfers are optional and for demonstration only.
        </p>
      </div>

      <MultiRailRouter />

      {/* Demonstration-only capacity indicators */}
      <div className="pt-4">
        <RailStatusViewer />
      </div>
    </div>
  );
};

export default PaymentRouter;
