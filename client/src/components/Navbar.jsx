import React, { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Activity, LogOut, Wallet, LayoutDashboard, Shield, Briefcase } from 'lucide-react';

const Navbar = () => {
  const { user, logout, walletAddress, connectWallet } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-fintech-card border-b border-slate-700/50 sticky top-0 z-50 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2 text-fintech-primary font-bold text-xl tracking-tight">
          <Activity size={24} />
          <span>Transact3</span>
        </Link>
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <Link
                to="/"
                className={`text-sm transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  isActive('/') ? 'bg-fintech-primary/10 text-fintech-primary' : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
              <Link
                to="/portfolio"
                className={`text-sm transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  isActive('/portfolio') ? 'bg-fintech-primary/10 text-fintech-primary' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Briefcase size={16} />
                Portfolio
              </Link>
              <Link
                to="/admin"
                className={`text-sm transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  isActive('/admin') ? 'bg-fintech-accent/10 text-fintech-accent' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shield size={16} />
                Admin
              </Link>

              <div className="flex items-center space-x-3 ml-2 border-l border-slate-700 pl-4">
                {/* Connect Wallet Button */}
                {walletAddress ? (
                  <div className="flex items-center gap-1.5 bg-fintech-darker text-fintech-primary px-3 py-1.5 rounded-lg text-xs font-mono border border-fintech-primary/20">
                    <Wallet size={14} />
                    {truncateAddress(walletAddress)}
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    className="flex items-center gap-1.5 bg-fintech-primary/10 hover:bg-fintech-primary/20 text-fintech-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-fintech-primary/20"
                  >
                    <Wallet size={14} />
                    Connect Wallet
                  </button>
                )}

                <span className="text-sm text-slate-400">Hi, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-slate-300 hover:text-red-400 transition-colors p-1.5 hover:bg-red-500/10 rounded-lg"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-300 hover:text-white transition-colors">Login</Link>
              <Link to="/register" className="btn-primary">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
