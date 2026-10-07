import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Settings, Shield } from 'lucide-react';
import api from '../services/api';

const Admin = () => {
  const [routes, setRoutes] = useState([]);
  const [capacityValues, setCapacityValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingRoute, setSavingRoute] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchRoutes = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get('/admin/rails');
      if (!data.success) throw new Error(data.message || 'Could not load route settings.');
      setRoutes(data.data);
      setCapacityValues(Object.fromEntries(
        data.data.map((route) => [route.railId, String(route.availableLiquidityUSD ?? 0)])
      ));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load route settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = setTimeout(fetchRoutes, 0);
    return () => clearTimeout(initialFetch);
  }, [fetchRoutes]);

  const updateRoute = async (railId, updates, successMessage) => {
    setSavingRoute(railId);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.put(`/admin/rails/${railId}`, updates);
      if (!data.success) throw new Error(data.message || 'Could not save route settings.');
      setMessage(successMessage);
      await fetchRoutes();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save route settings.');
    } finally {
      setSavingRoute(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Administrator</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold text-slate-900">
            <Shield className="text-emerald-700" size={26} />
            Route settings
          </h1>
        </div>
        <button type="button" onClick={fetchRoutes} disabled={loading} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh settings
        </button>
      </header>

      <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        These settings affect route comparisons only. They do not control or reserve capacity with external providers.
      </p>

      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}

      {loading && routes.length === 0 ? (
        <div className="card flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-emerald-700" />
            <h2 className="font-bold text-slate-900">Three route options</h2>
          </div>
          <div className="grid gap-4">
            {routes.map((route) => (
              <article key={route.railId} className="card space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{route.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{route.railId}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        route.isEnabled ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {route.isEnabled ? 'Included in comparisons' : 'Excluded from comparisons'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{route.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Reference pricing: ${Number(route.baseFeeUSD || 0).toFixed(2)} fixed + {route.variableFeeBps || 0} bps · Indicative time: {route.expectedSettlementDisplay || `${route.avgLatencyHours} hours`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateRoute(
                      route.railId,
                      { isEnabled: !route.isEnabled },
                      `${route.name} ${route.isEnabled ? 'excluded from' : 'included in'} comparisons.`
                    )}
                    disabled={savingRoute === route.railId}
                    className="btn-secondary shrink-0 disabled:opacity-50"
                  >
                    {route.isEnabled ? 'Exclude route' : 'Include route'}
                  </button>
                </div>

                <form
                  className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const capacity = Number(capacityValues[route.railId]);
                    if (!Number.isFinite(capacity) || capacity < 0) {
                      setError('Enter a valid non-negative route capacity.');
                      return;
                    }
                    updateRoute(route.railId, { availableLiquidityUSD: capacity }, 'Comparison capacity updated.');
                  }}
                >
                  <label className="flex-1 text-sm font-semibold text-slate-800">
                    Comparison capacity (USD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={capacityValues[route.railId] ?? ''}
                      onChange={(event) => setCapacityValues((current) => ({
                        ...current,
                        [route.railId]: event.target.value
                      }))}
                      className="input-field mt-1"
                    />
                  </label>
                  <button type="submit" disabled={savingRoute === route.railId} className="btn-primary disabled:opacity-50">
                    Save capacity
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Admin;
