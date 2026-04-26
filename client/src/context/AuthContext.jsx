import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await api.get('/user/me');
          setUser(res.data.data);
        }
      } catch (err) {
        console.error(err);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/user/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser({ _id: res.data._id, name: res.data.name, email: res.data.email, walletBalance: res.data.walletBalance });
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/user/register', { name, email, password });
    localStorage.setItem('token', res.data.token);
    setUser({ _id: res.data._id, name: res.data.name, email: res.data.email, walletBalance: res.data.walletBalance });
    return res.data;
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
      } catch (err) {
        console.error("User denied account access");
        setWalletAddress('0xMockWalletAddress1234567890abcdef');
      }
    } else {
      console.log('MetaMask not installed; using mock wallet.');
      setWalletAddress('0xMockWalletAddress1234567890abcdef');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setWalletAddress(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, walletAddress, connectWallet }}>
      {children}
    </AuthContext.Provider>
  );
};
