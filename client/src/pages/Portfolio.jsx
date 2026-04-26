import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  // Form state
  const [currency, setCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');

  const fetchPortfolio = async () => {
    try {
      const res = await api.get('/portfolio');
      setPortfolio(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleAddHolding = async (e) => {
    e.preventDefault();
    try {
      await api.post('/portfolio', {
        currency,
        amount: Number(amount),
        averageBuyPrice: Number(price)
      });
      setShowAdd(false);
      fetchPortfolio();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading portfolio...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Your Portfolio</h1>
          <p className="text-slate-400">Track your holdings and performance</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-slate-800 to-slate-900 border-fintech-primary/20">
          <h3 className="text-slate-400 text-sm mb-1">Total Balance</h3>
          <p className="text-3xl font-bold text-white flex items-center gap-1">
            <DollarSign size={28} className="text-fintech-primary" />
            {portfolio?.totalValueUSD?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-8 border border-fintech-primary/30">
          <h3 className="text-lg font-bold text-white mb-4">Add Holding</h3>
          <form onSubmit={handleAddHolding} className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Currency</label>
              <select className="input-field w-32" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="INR">INR</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Amount</label>
              <input type="number" required className="input-field w-32" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Avg Buy Price (USD)</label>
              <input type="number" step="0.01" required className="input-field w-32" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary mb-1">Save</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="p-4 font-medium text-slate-300">Asset</th>
              <th className="p-4 font-medium text-slate-300">Balance</th>
              <th className="p-4 font-medium text-slate-300">Value (USD)</th>
              <th className="p-4 font-medium text-slate-300">Profit / Loss</th>
            </tr>
          </thead>
          <tbody>
            {portfolio?.holdings?.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-500">No holdings yet. Add one above!</td>
              </tr>
            ) : (
              portfolio?.holdings?.map((item) => (
                <tr key={item._id} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-white">{item.currency}</td>
                  <td className="p-4 text-slate-300">{item.amount.toFixed(2)}</td>
                  <td className="p-4 font-medium text-white">${item.currentValueUSD?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`flex items-center gap-1 ${item.profitLoss >= 0 ? 'text-fintech-primary' : 'text-red-400'}`}>
                      {item.profitLoss >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      ${Math.abs(item.profitLoss || 0).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Portfolio;
