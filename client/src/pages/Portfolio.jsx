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

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-velto-lime" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-velto-muted uppercase mb-1">DIGITAL WALLET & FINANCIAL SERVICES</p>
          <h1 className="text-3xl font-bold text-velto-ink">Your Portfolio</h1>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-lime flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add Asset
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-velto-forest rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-velto-lime/10 rounded-full -translate-y-6 translate-x-6" />
          <p className="text-velto-lime/70 text-xs font-bold uppercase tracking-wider mb-2">Total Balance</p>
          <p className="text-3xl font-bold text-white flex items-center gap-1">
            <DollarSign size={26} className="text-velto-lime" />
            {portfolio?.totalValueUSD?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Add Holding Form */}
      {showAdd && (
        <div className="card border border-velto-lime/30">
          <h3 className="text-base font-bold text-velto-ink mb-4">Add Holding</h3>
          <form onSubmit={handleAddHolding} className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-velto-muted uppercase tracking-wider mb-1.5">Currency</label>
              <select className="input-field w-32 text-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="INR">INR</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-velto-muted uppercase tracking-wider mb-1.5">Amount</label>
              <input type="number" required className="input-field w-32 text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-velto-muted uppercase tracking-wider mb-1.5">Avg Buy Price (USD)</label>
              <input type="number" step="0.01" required className="input-field w-36 text-sm" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <button type="submit" className="btn-lime text-sm">Save</button>
          </form>
        </div>
      )}

      {/* Holdings Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-velto-surface border-b border-velto-surface-dark">
              <th className="p-4 text-xs font-bold text-velto-muted uppercase tracking-wider">Asset</th>
              <th className="p-4 text-xs font-bold text-velto-muted uppercase tracking-wider">Balance</th>
              <th className="p-4 text-xs font-bold text-velto-muted uppercase tracking-wider">Value (USD)</th>
              <th className="p-4 text-xs font-bold text-velto-muted uppercase tracking-wider">Profit / Loss</th>
            </tr>
          </thead>
          <tbody>
            {portfolio?.holdings?.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-velto-faint text-sm">
                  No holdings yet. Add one above!
                </td>
              </tr>
            ) : (
              portfolio?.holdings?.map((item) => (
                <tr key={item._id} className="border-b border-velto-surface hover:bg-velto-surface/60 transition-colors">
                  <td className="p-4 font-bold text-velto-forest">{item.currency}</td>
                  <td className="p-4 text-velto-muted font-medium">{item.amount.toFixed(2)}</td>
                  <td className="p-4 font-semibold text-velto-ink">${item.currentValueUSD?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`flex items-center gap-1 font-semibold text-sm ${item.profitLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.profitLoss >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
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
