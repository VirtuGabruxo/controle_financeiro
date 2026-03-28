import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showBalances, setShowBalances] = useState(false);
  const [loading, setLoading] = useState(true);

  // Group / Workspace Management
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [activeRole, setActiveRole] = useState('membro');

  // Theming Engine
  const [themeMode, setThemeMode] = useState(localStorage.getItem('fincontrol_theme') || 'dark');
  const [accentColor, setAccentColor] = useState('emerald');

  const fetchUserGroups = async (userId) => {
    const { data: memberships } = await supabase
      .from('membros_grupo')
      .select('grupo_id, papel, grupos(id, nome, cor)')
      .eq('user_id', userId);
    
    if (memberships) {
      const groups = memberships.map(m => ({
        id: m.grupos.id,
        nome: m.grupos.nome,
        cor: m.grupos.cor,
        papel: m.papel
      }));
      setUserGroups(groups);
      return groups;
    }
    return [];
  };

  const handleActiveGroupChange = async (groupId) => {
    if (!user) return;
    setActiveGroupId(groupId);
    
    // Atualizar o papel ativo localmente baseado na lista suspensa
    const group = userGroups.find(g => g.id === groupId);
    if (group) setActiveRole(group.papel);
    
    await supabase.from('profiles').update({ grupo_ativo_id: groupId }).eq('id', user.id);
  };

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
    const initializeUser = async (sessionUser) => {
      try {
        if (!sessionUser) {
          setLoading(false);
          return;
        }
        
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).single();
        const groups = await fetchUserGroups(sessionUser.id);
        
        if (profileData) {
          setProfile(profileData);
          setShowBalances(!profileData.ocultar_saldos);
          if (profileData.cor_destaque) setAccentColor(profileData.cor_destaque);
          
          // Define active group
          let currentGroupId = null;
          if (profileData.grupo_ativo_id) {
            currentGroupId = profileData.grupo_ativo_id;
          } else if (groups && groups.length > 0) {
            currentGroupId = groups[0].id;
            // Persiste a seleção automática do grupo pessoal para evitar estados NULL
            await supabase.from('profiles').update({ grupo_ativo_id: currentGroupId }).eq('id', sessionUser.id);
          }
          
          if (currentGroupId) {
            setActiveGroupId(currentGroupId);
            const activeGrp = groups.find(g => g.id === currentGroupId);
            if (activeGrp) setActiveRole(activeGrp.papel);
          }
        }
      } catch (err) {
        console.error("Erro ao inicializar usuário:", err);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      initializeUser(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        initializeUser(session.user);
      } else {
        setProfile(null);
        setActiveGroupId(null);
        setUserGroups([]);
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

  const refreshGroups = async () => {
    if (user) {
      await fetchUserGroups(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, setProfile, 
      showBalances, setShowBalances, 
      themeMode, setThemeMode, accentColor, setAccentColor,
      activeGroupId, setActiveGroupId: handleActiveGroupChange, userGroups, refreshGroups, activeRole,
      signUp, signIn, signOut, 
      resetPassword, updatePassword, loading 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
