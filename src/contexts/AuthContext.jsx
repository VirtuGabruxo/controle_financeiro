import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showBalances, setShowBalances] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pegar a sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setShowBalances(!data.ocultar_saldos);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    // Escutar mudanças na autenticação (login, logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setShowBalances(!data.ocultar_saldos);
            }
          });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    return supabase.auth.signUp({ email, password });
  };

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/update-password',
    });
  };

  const updatePassword = async (password) => {
    return supabase.auth.updateUser({ password });
  };

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, showBalances, setShowBalances, signUp, signIn, signOut, resetPassword, updatePassword, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
