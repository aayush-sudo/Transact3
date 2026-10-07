import TransactionHistory from '../components/TransactionHistory';
import TransactionTimeline from '../components/TransactionTimeline';

const Transactions = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
          OPTIONAL SIMULATED DEMO ACTIVITY
        </p>
        <h1 className="text-3xl font-extrabold text-white">Demo transfers & activity</h1>
      </div>

      <p className="text-sm text-slate-600">
        This history contains simulated examples from the optional demo only. Transact3 does not process real payments.
      </p>

      <TransactionTimeline currentStatus="COMPLETED" />
      <TransactionHistory />
    </div>
  );
};

export default Transactions;
