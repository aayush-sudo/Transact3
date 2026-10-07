import { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Send, ShieldCheck, Sparkles, TrendingUp, BarChart2 } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 lg:px-6 py-3 flex flex-wrap gap-3 justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
          <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <span className="text-slate-900 font-extrabold text-lg tracking-tight block leading-tight">Transact3</span>
            <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-widest block">Independent transfer guidance</span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 flex-wrap">
          {user ? (
            <>
              <Link
                to="/"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/') && location.pathname === '/'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard size={14} />
                Overview
              </Link>
              <Link
                to="/payment-router"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/payment-router')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Send size={14} />
                Compare options
              </Link>
              <Link
                to="/fx-forecasting"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/fx-forecasting')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TrendingUp size={14} />
                FX outlook
              </Link>
              <Link
                to="/evaluation"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/evaluation')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BarChart2 size={14} />
                About the model
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                    isActive('/admin')
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck size={14} />
                  Admin
                </Link>
              )}

              <div className="flex items-center gap-3 ml-2 pl-2 border-l border-slate-200">
                <span className="text-xs text-slate-600 hidden sm:inline">Hi, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-rose-700 transition-colors p-1.5 hover:bg-rose-50 rounded-lg"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-600 hover:text-slate-900 text-xs font-bold px-3 py-2">Login</Link>
              <Link to="/register" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">Create account</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
