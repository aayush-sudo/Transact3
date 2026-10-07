import { useCallback, useContext, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const loadCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = resolve;
  script.onerror = () => reject(new Error('Could not load the secure payment checkout.'));
  document.body.appendChild(script);
});

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingVerification, setPendingVerification] = useState(null);
  const { user } = useContext(AuthContext);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [walletResult, activityResult] = await Promise.all([
        api.get('/portfolio'),
        api.get('/transaction/history')
      ]);
      setPortfolio(walletResult.data.data);
      setTransactions(activityResult.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your wallet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(refresh, 0);
    return () => clearTimeout(initialLoad);
  }, [refresh]);

  const verifyPayment = async (payment) => {
    setFunding(true);
    setError('');
    try {
      await api.post('/portfolio/funding/verify', payment);
      setPendingVerification(null);
      setNotice('Payment verified. Your INR wallet has been updated.');
      await refresh();
    } catch (err) {
      setPendingVerification(payment);
      setError(err.response?.data?.message || 'Payment verification is pending. Retry verification below.');
    } finally {
      setFunding(false);
    }
  };

  const addFunds = async (event) => {
    event.preventDefault();
    setFunding(true);
    setError('');
    setNotice('');
    try {
      await loadCheckout();
      const { data: orderResult } = await api.post('/portfolio/funding/order', { amount: Number(amount) });
      const order = orderResult.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Transact3 Wallet',
        description: 'INR wallet funding',
        order_id: order.orderId,
        prefill: { email: user?.email || '' },
        theme: { color: '#047857' },
        handler: verifyPayment,
        modal: {
          ondismiss: () => setFunding(false)
        }
      });
      checkout.on('payment.failed', (paymentError) => {
        setError(paymentError.error?.description || 'Payment was not completed.');
        setFunding(false);
      });
      checkout.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not start wallet funding.');
      setFunding(false);
    }
  };

  const holdings = portfolio?.holdings || [];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your account</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold text-slate-900">
            <Wallet className="text-emerald-700" size={26} /> Wallet
          </h1>
          <p className="mt-1 text-sm text-slate-600">Manage available balances and track scheduled transfers.</p>
        </div>
        <button type="button" onClick={refresh} className="btn-secondary inline-flex items-center gap-2" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
      {pendingVerification && (
        <button
          type="button"
          onClick={() => verifyPayment(pendingVerification)}
          disabled={funding}
          className="btn-secondary"
        >
          {funding ? 'Verifying payment…' : 'Retry payment verification'}
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Available balances</h2>
              <p className="mt-1 text-sm text-slate-500">New accounts start with zero funds.</p>
            </div>
            <Wallet className="text-emerald-700" size={20} />
          </div>
          {loading && !portfolio ? (
            <p className="mt-6 text-sm text-slate-500">Loading wallet…</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {holdings.map((holding) => (
                <div key={holding.currency} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{holding.currency}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {Number(holding.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">≈ ${Number(holding.currentValueUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="text-lg font-bold text-slate-900">Add money</h2>
          <p className="mt-1 text-sm text-slate-600">Fund your INR wallet using UPI, net banking, or an available checkout method.</p>
          <form onSubmit={addFunds} className="mt-5 space-y-3">
            <label htmlFor="wallet-fund-amount" className="block text-sm font-semibold text-slate-800">Amount (INR)</label>
            <input
              id="wallet-fund-amount"
              className="input-field"
              type="number"
              min="1"
              max="100000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60" disabled={funding}>
              <ArrowDownToLine size={16} />
              {funding ? 'Opening secure checkout…' : 'Add INR with Razorpay'}
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">Test-mode payments only. Funds are added after the server verifies the captured payment.</p>
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-bold text-slate-900">Recent transfers</h2>
            <p className="mt-1 text-xs text-slate-500">Scheduled transfers reserve the amount until settlement.</p>
          </div>
          <ArrowUpRight size={18} className="text-slate-400" />
        </div>
        {transactions.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No transfers yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.slice(0, 8).map((transaction) => (
              <div key={transaction._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {transaction.sourceAmount} {transaction.sourceCurrency} → {transaction.destinationAmount} {transaction.destinationCurrency}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {transaction.receiverEmail} · {new Date(transaction.scheduledFor || transaction.timestamp).toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  transaction.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                    transaction.status === 'FAILED' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                }`}>{transaction.status === 'SCHEDULED' ? 'Scheduled' : transaction.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

export default Portfolio;
