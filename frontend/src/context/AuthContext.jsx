import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('civic_jwt_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('civic_jwt_token');

      // 1. Try Node.js Backend JWT Auth
      if (storedToken) {
        try {
          const userData = await authApi.getMe(storedToken);
          setUser(userData);
          setProfile(userData);
          setToken(storedToken);
          setLoading(false);
          return;
        } catch (err) {
          console.warn('[Auth] Stored JWT session expired or invalid. Clearing.');
          localStorage.removeItem('civic_jwt_token');
          setToken(null);
        }
      }

      // 2. Try Supabase Auth session if configured
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            setToken(session.access_token);
            setProfile({
              id: session.user.id,
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
              email: session.user.email,
              role: session.user.user_metadata?.role || 'Citizen'
            });
          }
        } catch (supaErr) {
          console.warn('[Supabase Auth]:', supaErr);
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Register User
  const signUp = async ({ email, password, fullName, role = 'Citizen' }) => {
    try {
      // Prioritize Node.js Backend API
      const res = await authApi.register({
        name: fullName,
        email,
        password,
        role: role === 'citizen' ? 'Citizen' : (role === 'administrator' ? 'Administrator' : 'Department_Officer')
      });

      if (res.token && res.user) {
        localStorage.setItem('civic_jwt_token', res.token);
        setToken(res.token);
        setUser(res.user);
        setProfile(res.user);
        return res;
      }
    } catch (apiErr) {
      // If backend auth fails and Supabase is configured, try Supabase fallback
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } }
        });
        if (error) throw error;
        return data;
      }
      throw apiErr;
    }
  };

  // Sign In User
  const signIn = async ({ email, password }) => {
    try {
      // Prioritize Node.js Backend API
      const res = await authApi.login({ email, password });
      if (res.token && res.user) {
        localStorage.setItem('civic_jwt_token', res.token);
        setToken(res.token);
        setUser(res.user);
        setProfile(res.user);
        return res;
      }
    } catch (apiErr) {
      // If backend login fails and Supabase is configured, try Supabase fallback
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          setToken(data.session.access_token);
          setUser(data.user);
          setProfile({
            id: data.user.id,
            name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
            email: data.user.email,
            role: data.user.user_metadata?.role || 'Citizen'
          });
        }
        return data;
      }
      throw apiErr;
    }
  };

  // Sign Out
  const signOut = async () => {
    try {
      await authApi.logout().catch(() => {});
    } catch (_) {}

    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    localStorage.removeItem('civic_jwt_token');
    setUser(null);
    setProfile(null);
    setToken(null);
  };

  // Password reset placeholder
  const resetPassword = async (email) => {
    if (supabase) {
      return await supabase.auth.resetPasswordForEmail(email);
    }
    return { success: true, message: 'Password reset link simulated.' };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        loading,
        isConfigured: true,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshProfile: async () => {
          if (token) {
            const u = await authApi.getMe(token);
            setUser(u);
            setProfile(u);
          }
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
