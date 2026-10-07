import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, TrendingUp, Wallet } from 'lucide-react';

const Dashboard = () => (
  <div className="space-y-8">
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Independent transfer guidance</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
        Make informed choices for international transfers.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
        Fund your wallet in Razorpay test mode, compare estimated transfer routes, and schedule a modeled settlement with clear timing guidance.
      </p>
      <Link to="/payment-router" className="btn-primary mt-7 inline-flex items-center gap-2">
        Compare transfer options <ArrowRight size={17} />
      </Link>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <Link to="/payment-router" className="card group transition-colors hover:border-emerald-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Compare routes</h2>
          <ArrowRight size={18} className="text-emerald-700 transition-transform group-hover:translate-x-1" />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Review costs, timing, and route details for your currency corridor.</p>
      </Link>
      <Link to="/wallet" className="card group transition-colors hover:border-emerald-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Wallet</h2>
          <Wallet size={18} className="text-emerald-700" />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Manage balances, add INR using test checkout, and review scheduled transfers.</p>
      </Link>
      <Link to="/fx-forecasting" className="card group transition-colors hover:border-emerald-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Exchange-rate outlook</h2>
          <TrendingUp size={18} className="text-emerald-700" />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Explore currency trends and model-derived guidance.</p>
      </Link>
      <Link to="/evaluation" className="card group transition-colors hover:border-emerald-300 md:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">How route recommendations work</h2>
          <BarChart2 size={18} className="text-emerald-700" />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Learn how route rankings balance cost, delivery time, and reliability.</p>
      </Link>
    </section>
  </div>
);

export default Dashboard;
