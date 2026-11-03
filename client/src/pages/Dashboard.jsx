import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart2, TrendingUp, Wallet, Sparkles, Bot, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { aiQuery } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAI = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const response = await aiQuery(aiInput);
      const data = response.data;
      if (data.success) {
        navigate('/ai-agent');
      }
    } catch (err) {
      console.error('AI query failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
  <div className="space-y-8">
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Independent transfer guidance</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
        Make informed choices for international transfers.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
        Fund your wallet with your preferred payment method, compare estimated transfer routes, and schedule a settlement with clear timing guidance.
      </p>
      <Link to="/payment-router" className="btn-primary mt-7 inline-flex items-center gap-2">
        Compare transfer options <ArrowRight size={17} />
      </Link>
    </section>

    {/* AI Transfer Assistant Section */}
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-emerald-50 rounded-full blur-2xl opacity-40" />
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between sm:justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <Bot size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">AI Transfer Assistant</p>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Tell us where you want to send money</h2>
            <p className="mt-1 text-sm text-slate-500">We'll find the smartest way to transfer.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-end items-end sm:items-start">
          <input
            id="ai-assistant-input"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            placeholder="e.g., Transfer $500 USD to INR with the lowest fees..."
            className="w-full sm:w-[320px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors placeholder:text-slate-400"
          />
          <button
            onClick={handleAskAI}
            disabled={!aiInput.trim() || aiLoading}
            className="btn-primary px-6 py-2 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Ask AI
          </button>
          <Link
            to="/ai-agent"
            className="btn-secondary px-4 py-2 inline-flex items-center gap-2 text-xs font-medium"
          >
            Open AI Agent <ArrowRight size={14} />
          </Link>
        </div>
      </div>
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
        <p className="mt-2 text-sm leading-6 text-slate-600">Manage balances, add funds, and review scheduled transfers.</p>
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
};

export default Dashboard;