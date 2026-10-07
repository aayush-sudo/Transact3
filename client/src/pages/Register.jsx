import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Lock, Mail, User } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-emerald-50 border-r border-emerald-100 p-12">
        <div>
          <div className="w-10 h-10 bg-emerald-700 rounded-xl flex items-center justify-center mb-12">
            <span className="text-white font-black text-xs leading-none">T3</span>
          </div>
          <h1 className="text-slate-900 text-5xl font-bold leading-tight mb-4">
            MAKE A MORE<br />INFORMED<br />CHOICE
          </h1>
          <p className="text-slate-600 text-lg">Compare estimated costs and delivery times. You choose where to send.</p>
        </div>
        <div className="flex gap-3">
          <span className="bg-white text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">compare</span>
          <span className="bg-white text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200">understand</span>
          <span className="bg-white text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200">choose</span>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">T3</span>
            </div>
            <span className="text-slate-900 font-bold text-xl">Transact3</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-1">Create account</h2>
          <p className="text-slate-600 mb-8">Create an account to access transfer comparisons and exchange-rate guidance.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={16} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={16} className="text-slate-400" />
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
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={16} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  className="input-field pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}"
                  title="Use 8–72 characters with uppercase, lowercase, a number, and a symbol"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">8–72 characters; include uppercase, lowercase, a number, and a symbol.</p>
            </div>

            <button
              type="submit"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl w-full py-3 mt-2 text-base transition-colors"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Get Started'}
            </button>
          </form>

          <p className="text-center mt-6 text-slate-600 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-800 font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
