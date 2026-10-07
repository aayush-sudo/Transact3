import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import PaymentRouter from './pages/PaymentRouter';
import Transactions from './pages/Transactions';
import Portfolio from './pages/Portfolio';
import FXForecasting from './pages/FXForecasting';
import Evaluation from './pages/Evaluation';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';

const PrivateRoute = ({ children }) => {
  const { user, loading } = React.useContext(AuthContext);
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
        <p className="text-slate-500 text-sm">Loading Transact3...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = React.useContext(AuthContext);
  if (loading) return null;
  return user?.role === 'ADMIN' ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans selection:bg-emerald-200 selection:text-slate-900">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/payment-router" element={<PrivateRoute><PaymentRouter /></PrivateRoute>} />
              <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
              <Route path="/wallet" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
              <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
              <Route path="/fx-forecasting" element={<PrivateRoute><FXForecasting /></PrivateRoute>} />
              <Route path="/evaluation" element={<PrivateRoute><Evaluation /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><AdminRoute><Admin /></AdminRoute></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
