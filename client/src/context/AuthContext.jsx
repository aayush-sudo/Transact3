import { createContext, useState, useEffect } from 'react';
import api from '../services/api';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await api.get('/user/me');
          setUser(res.data.data);
        } else {
          setUser(null);
        }
      } catch {
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/user/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser({
      _id: res.data._id,
      name: res.data.name,
      email: res.data.email,
      role: res.data.role,
      walletBalance: res.data.walletBalance,
      accountCountry: res.data.accountCountry,
      accountCountryVerified: res.data.accountCountryVerified,
      accountCountryVerificationSource: res.data.accountCountryVerificationSource,
      kycStatus: res.data.kycStatus,
      kycVerificationSource: res.data.kycVerificationSource,
      demoVerificationEnabled: res.data.demoVerificationEnabled
    });
    return res.data;
  };

  const register = async (name, email, password, accountCountry) => {
    const res = await api.post('/user/register', { name, email, password, accountCountry });
    localStorage.setItem('token', res.data.token);
    setUser({
      _id: res.data._id,
      name: res.data.name,
      email: res.data.email,
      role: res.data.role,
      walletBalance: res.data.walletBalance,
      accountCountry: res.data.accountCountry,
      accountCountryVerified: res.data.accountCountryVerified,
      accountCountryVerificationSource: res.data.accountCountryVerificationSource,
      kycStatus: res.data.kycStatus,
      kycVerificationSource: res.data.kycVerificationSource,
      demoVerificationEnabled: res.data.demoVerificationEnabled
    });
    return res.data;
  };

  const updateAccountCountry = async (accountCountry) => {
    const res = await api.patch('/user/account-country', { accountCountry });
    setUser((currentUser) => ({ ...currentUser, ...res.data.data }));
    return res.data.data;
  };

  const completeDemoVerification = async () => {
    const res = await api.post('/user/demo-verification');
    setUser((currentUser) => ({ ...currentUser, ...res.data.data }));
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, updateAccountCountry, completeDemoVerification, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
