import React, { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, Wallet, LayoutDashboard, Shield, Briefcase } from 'lucide-react';

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
    <nav className="bg-white border-b border-velto-surface sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-velto-forest rounded-lg flex items-center justify-center">
            <span className="text-velto-lime font-black text-xs leading-none">T3</span>
          </div>
          <span className="text-velto-forest font-bold text-xl tracking-tight">Transact3</span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/"
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/') ? 'bg-velto-forest text-velto-lime' : 'text-velto-muted hover:text-velto-ink hover:bg-velto-surface'
                }`}
              >
                <LayoutDashboard size={15} />
                Dashboard
              </Link>
              <Link
                to="/portfolio"
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/portfolio') ? 'bg-velto-forest text-velto-lime' : 'text-velto-muted hover:text-velto-ink hover:bg-velto-surface'
                }`}
              >
                <Briefcase size={15} />
                Portfolio
              </Link>
              <Link
                to="/admin"
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  isActive('/admin') ? 'bg-velto-forest text-velto-lime' : 'text-velto-muted hover:text-velto-ink hover:bg-velto-surface'
                }`}
              >
                <Shield size={15} />
                Admin
              </Link>

              <div className="flex items-center gap-3 ml-2 pl-4 border-l border-velto-surface">
                {walletAddress ? (
                  <div className="flex items-center gap-1.5 bg-velto-surface text-velto-forest px-3 py-1.5 rounded-xl text-xs font-mono border border-velto-surface-dark">
                    <Wallet size={13} />
                    {truncateAddress(walletAddress)}
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    className="flex items-center gap-1.5 bg-velto-lime/20 hover:bg-velto-lime/40 text-velto-forest px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border border-velto-lime/30"
                  >
                    <Wallet size={13} />
                    Connect Wallet
                  </button>
                )}

                <span className="text-sm text-velto-muted font-medium">Hi, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-velto-muted hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                  title="Logout"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-velto-muted hover:text-velto-ink text-sm font-medium transition-colors px-3 py-2">Login</Link>
              <Link to="/register" className="btn-primary text-sm">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
