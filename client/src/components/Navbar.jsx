import React, { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, LayoutDashboard, TrendingUp, Activity, History, Award, Sparkles } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-gray-900/90 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles size={18} className="text-gray-950" />
          </div>
          <div>
            <span className="text-white font-extrabold text-lg tracking-tight block leading-tight font-mono">TRANSACT3</span>
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest block">AI Payment Orchestration</span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <Link
                to="/"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <LayoutDashboard size={14} />
                Dashboard
              </Link>
              <Link
                to="/fx-forecasting"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/fx-forecasting') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <TrendingUp size={14} />
                FX Forecasting
              </Link>
              <Link
                to="/liquidity"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/liquidity') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Activity size={14} />
                Liquidity
              </Link>
              <Link
                to="/transactions"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/transactions') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <History size={14} />
                Transactions
              </Link>
              <Link
                to="/evaluation"
                className={`text-xs font-bold font-mono transition-all flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/evaluation') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Award size={14} />
                Evaluation
              </Link>

              <div className="flex items-center gap-3 ml-3 pl-3 border-l border-gray-800">
                <span className="text-xs text-gray-300 font-mono">Hi, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-rose-400 transition-colors p-1.5 hover:bg-rose-500/10 rounded-lg"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-400 hover:text-white text-xs font-bold font-mono px-3 py-2">Login</Link>
              <Link to="/register" className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-4 py-2 rounded-xl text-xs font-bold font-mono shadow-md">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
