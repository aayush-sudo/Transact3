import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import FXForecasting from './pages/FXForecasting';
import Liquidity from './pages/Liquidity';
import Transactions from './pages/Transactions';
import Evaluation from './pages/Evaluation';

const PrivateRoute = ({ children }) => {
  const { user, loading } = React.useContext(AuthContext);
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
        <p className="text-gray-400 text-sm font-mono">Loading TRANSACT3...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100 font-sans selection:bg-emerald-500 selection:text-gray-950">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/fx-forecasting" element={<PrivateRoute><FXForecasting /></PrivateRoute>} />
              <Route path="/liquidity" element={<PrivateRoute><Liquidity /></PrivateRoute>} />
              <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
              <Route path="/evaluation" element={<PrivateRoute><Evaluation /></PrivateRoute>} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
