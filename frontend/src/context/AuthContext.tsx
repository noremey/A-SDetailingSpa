import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/api';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (identifier: string, password?: string) => Promise<void>;
  register: (data: { name: string; phone: string; email?: string; plate_number: string; vehicle_type?: string }) => Promise<void>;
  googleLogin: (credential: string) => Promise<{ is_new_user: boolean; needs_vehicle: boolean; needs_phone: boolean; needs_profile_completion: boolean }>;
  setAuthFromGoogle: (token: string, user: User, needsProfile: boolean) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  needsProfileCompletion: boolean;
  clearProfileCompletion: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    const user = userStr ? JSON.parse(userStr) : null;
    return {
      token,
      user,
      isAuthenticated: !!token,
      isAdmin: user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'staff',
    };
  });

  const [needsProfileCompletion, setNeedsProfileCompletion] = useState<boolean>(() => {
    const stored = localStorage.getItem('needs_profile_completion');
    return stored === 'true';
  });

  const setAuth = (token: string, user: User) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    setState({
      token,
      user,
      isAuthenticated: true,
      isAdmin: user.role === 'admin' || user.role === 'super_admin' || user.role === 'staff',
    });
  };

  const login = async (identifier: string, password?: string) => {
    const { data } = await authService.login(identifier, password);
    if (data.success) {
      setAuth(data.token, data.user);
      // Check profile completion for customers
      if (data.needs_profile_completion) {
        setNeedsProfileCompletion(true);
        localStorage.setItem('needs_profile_completion', 'true');
      } else {
        setNeedsProfileCompletion(false);
        localStorage.removeItem('needs_profile_completion');
      }
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const register = async (regData: { name: string; phone: string; email?: string; plate_number: string; vehicle_type?: string }) => {
    const { data } = await authService.register(regData);
    if (data.success) {
      setAuth(data.token, data.user);
      // Registration always includes phone + plate, so profile is complete
      setNeedsProfileCompletion(false);
      localStorage.removeItem('needs_profile_completion');
    } else {
      throw new Error(data.message || 'Registration failed');
    }
  };

  const googleLogin = async (credential: string) => {
    const { data } = await authService.googleLogin(credential);
    if (data.success) {
      setAuth(data.token, data.user);
      const profileIncomplete = data.needs_profile_completion || false;
      if (profileIncomplete) {
        setNeedsProfileCompletion(true);
        localStorage.setItem('needs_profile_completion', 'true');
      } else {
        setNeedsProfileCompletion(false);
        localStorage.removeItem('needs_profile_completion');
      }
      return {
        is_new_user: data.is_new_user || false,
        needs_vehicle: data.needs_vehicle || false,
        needs_phone: data.needs_phone || false,
        needs_profile_completion: profileIncomplete,
      };
    } else {
      throw new Error(data.message || 'Google login failed');
    }
  };

  const setAuthFromGoogle = (token: string, user: User, needsProfile: boolean) => {
    setAuth(token, user);
    if (needsProfile) {
      setNeedsProfileCompletion(true);
      localStorage.setItem('needs_profile_completion', 'true');
    } else {
      setNeedsProfileCompletion(false);
      localStorage.removeItem('needs_profile_completion');
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('needs_profile_completion');
    setNeedsProfileCompletion(false);
    setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  };

  const clearProfileCompletion = () => {
    setNeedsProfileCompletion(false);
    localStorage.removeItem('needs_profile_completion');
  };

  const refreshUser = async () => {
    try {
      const { data } = await authService.me();
      if (data.success && data.user) {
        const freshUser = data.user as User;
        // Check if the token's user matches the stored user
        const storedUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
        if (storedUser.id && freshUser.id !== storedUser.id) {
          // Token belongs to a different user — force logout
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          localStorage.removeItem('needs_profile_completion');
          setNeedsProfileCompletion(false);
          setState({
            token: null,
            user: null,
            isAuthenticated: false,
            isAdmin: false,
          });
          return;
        }
        localStorage.setItem('auth_user', JSON.stringify(freshUser));
        setState(prev => ({
          ...prev,
          user: freshUser,
          isAdmin: freshUser.role === 'admin' || freshUser.role === 'super_admin' || freshUser.role === 'staff',
        }));
        // Update profile completion from server
        if (freshUser.role === 'customer' || freshUser.role === undefined) {
          if (freshUser.needs_profile_completion) {
            setNeedsProfileCompletion(true);
            localStorage.setItem('needs_profile_completion', 'true');
          } else {
            setNeedsProfileCompletion(false);
            localStorage.removeItem('needs_profile_completion');
          }
        }
      }
    } catch {
      // Token might be expired
    }
  };

  // Refresh user on mount if authenticated
  useEffect(() => {
    if (state.isAuthenticated) {
      refreshUser();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, googleLogin, setAuthFromGoogle, logout, refreshUser, needsProfileCompletion, clearProfileCompletion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
