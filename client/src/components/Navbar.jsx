import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Activity, LogOut, Wallet } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-fintech-card border-b border-slate-700/50 sticky top-0 z-50 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2 text-fintech-primary font-bold text-xl tracking-tight">
          <Activity size={24} />
          <span>Transact3</span>
        </Link>
        <div className="flex items-center space-x-6">
          {user ? (
            <>
              <Link to="/" className="text-slate-300 hover:text-white transition-colors">Dashboard</Link>
              <Link to="/portfolio" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1">
                <Wallet size={18} /> Portfolio
              </Link>
              <div className="flex items-center space-x-4 ml-4 border-l border-slate-700 pl-4">
                <span className="text-sm text-slate-400">Hello, {user.name}</span>
                <button 
                  onClick={handleLogout}
                  className="text-slate-300 hover:text-red-400 transition-colors flex items-center gap-1"
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
