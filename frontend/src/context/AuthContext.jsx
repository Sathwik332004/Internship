import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    localStorage.removeItem('user');
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await authAPI.getMe();
        setUser(response.data.data);
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });

    // Admin 2FA: OTP required — don't store token yet
    if (response.data.requiresOTP) {
      return response.data; // { requiresOTP: true, email }
    }

    // Staff direct login
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.data));
    setUser(response.data.data);
    return response.data;
  };

  const verifyLoginOTP = async (email, otp) => {
    const response = await authAPI.verifyLoginOTP({ email, otp });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.data));
    setUser(response.data.data);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    setUser,
    loading,
    login,
    verifyLoginOTP,
    logout,
    isAuthenticated: !!user || !!localStorage.getItem('token'),
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff'
  };

return (
  <AuthContext.Provider value={value}>
    {children}
  </AuthContext.Provider>
);
};
