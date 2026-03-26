import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showBalances, setShowBalances] = useState(false);
  const [loading, setLoading] = useState(true);

  // Theming Engine
  const [themeMode, setThemeMode] = useState(localStorage.getItem('fincontrol_theme') || 'dark');
  const [accentColor, setAccentColor] = useState('emerald');

  // Apply Theme Mode (Dark/Light)
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'light') root.classList.remove('dark');
    else root.classList.add('dark');
    localStorage.setItem('fincontrol_theme', themeMode);
  }, [themeMode]);

  // Apply Accent Color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', accentColor);
  }, [accentColor]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setShowBalances(!data.ocultar_saldos);
              if (data.cor_destaque) setAccentColor(data.cor_destaque);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setShowBalances(!data.ocultar_saldos);
              if (data.cor_destaque) setAccentColor(data.cor_destaque);
            }
          });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => supabase.auth.signUp({ email, password });
  const signIn = async (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = async () => supabase.auth.signOut();
  const resetPassword = async (email) => {
    const redirectTo = `${window.location.origin}/update-password`;
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
  };
  const updatePassword = async (password) => supabase.auth.updateUser({ password });

  return (
    <AuthContext.Provider value={{ 
      user, profile, setProfile, 
      showBalances, setShowBalances, 
      themeMode, setThemeMode, accentColor, setAccentColor,
      signUp, signIn, signOut, 
      resetPassword, updatePassword, loading 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
