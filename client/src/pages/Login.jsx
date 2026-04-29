import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Lock, Mail } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-velto-forest p-12">
        <div>
          <div className="w-10 h-10 bg-velto-lime rounded-xl flex items-center justify-center mb-12">
            <span className="text-velto-forest font-black text-xs leading-none">T3</span>
          </div>
          <h1 className="text-white text-5xl font-bold leading-tight mb-4">
            ONE APP FOR<br />A FASTER<br />GLOBAL LIFE
          </h1>
          <p className="text-velto-lime/70 text-lg">Send, receive, and manage money across borders.</p>
        </div>
        <div className="flex gap-3">
          <span className="bg-velto-lime text-velto-forest text-xs font-bold px-3 py-1.5 rounded-full">send</span>
          <span className="border border-white/20 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full">receive</span>
          <span className="border border-white/20 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full">money</span>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-velto-offwhite">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-velto-forest rounded-lg flex items-center justify-center">
              <span className="text-velto-lime font-black text-xs">T3</span>
            </div>
            <span className="text-velto-forest font-bold text-xl">Transact3</span>
          </div>

          <h2 className="text-3xl font-bold text-velto-ink mb-1">Welcome back</h2>
          <p className="text-velto-muted mb-8">Sign in to your Transact3 account</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-velto-ink mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={16} className="text-velto-faint" />
                </div>
                <input
                  type="email"
                  className="input-field pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-velto-ink mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={16} className="text-velto-faint" />
                </div>
                <input
                  type="password"
                  className="input-field pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-lime w-full py-3 mt-2 text-base"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Get Started'}
            </button>
          </form>

          <p className="text-center mt-6 text-velto-muted text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-velto-forest font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
