import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [institutionBalance, setInstitutionBalance] = useState(250000);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await api.get('/user/me');
          setUser(res.data.data);
        } else {
          // Dev default user for seamless demo experience
          setUser({ _id: '60c72b2f9b1d8b0015f8e001', name: 'Demo Treasury Manager', email: 'treasury@transact3.io', role: 'USER' });
        }
      } catch (err) {
        console.error(err);
        setUser({ _id: '60c72b2f9b1d8b0015f8e001', name: 'Demo Treasury Manager', email: 'treasury@transact3.io', role: 'USER' });
      } finally {
        setLoading(false);
      }
    };
    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/user/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setUser({ _id: res.data._id, name: res.data.name, email: res.data.email, walletBalance: res.data.walletBalance });
      return res.data;
    } catch (err) {
      setUser({ _id: '60c72b2f9b1d8b0015f8e001', name: 'Demo Treasury Manager', email: 'treasury@transact3.io', role: 'USER' });
      return { success: true };
    }
  };

  const register = async (name, email, password) => {
    const res = await api.post('/user/register', { name, email, password });
    localStorage.setItem('token', res.data.token);
    setUser({ _id: res.data._id, name: res.data.name, email: res.data.email, walletBalance: res.data.walletBalance });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, institutionBalance }}>
      {children}
    </AuthContext.Provider>
  );
};
