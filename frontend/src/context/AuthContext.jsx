import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    if (response.data.requiresOTP) {
      // Admin requires OTP verification
      return { requiresOTP: true, userId: response.data.userId };
    }
    // Staff login directly (no OTP required)
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.data));
    setUser(response.data.data);
    return response.data;
  };

  const verifyOTP = async (userId, otp) => {
    const response = await authAPI.verifyOTP({ userId, otp });
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
  verifyOTP,
  logout,
  isAuthenticated: !!user,
  isAdmin: user?.role === 'admin',
  isStaff: user?.role === 'staff'
};

return (
  <AuthContext.Provider value={value}>
    {children}
  </AuthContext.Provider>
);
};
