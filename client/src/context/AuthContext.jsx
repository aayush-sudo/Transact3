import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

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
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setWalletAddress(accounts[0]);
        
        const balanceWei = await provider.getBalance(accounts[0]);
        const balanceEth = ethers.formatEther(balanceWei);
        setWalletBalance(parseFloat(balanceEth));
      } catch (err) {
        console.error("User denied account access or error:", err);
      }
    } else {
      console.log('MetaMask not installed.');
    }
  };

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          // Refresh balance
          const provider = new ethers.BrowserProvider(window.ethereum);
          provider.getBalance(accounts[0]).then(balanceWei => {
            setWalletBalance(parseFloat(ethers.formatEther(balanceWei)));
          });
        } else {
          setWalletAddress(null);
          setWalletBalance(0);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setWalletAddress(null);
    setWalletBalance(0);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, walletAddress, walletBalance, connectWallet }}>
      {children}
    </AuthContext.Provider>
  );
};
