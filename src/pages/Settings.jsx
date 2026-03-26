import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, User, Lock, Download, AlertTriangle, Shield, Palette, Wallet, Trash2, Loader2, Plus, Moon, Sun, Bell, Edit2, X, Tag, ShoppingCart, Utensils, Car, Bus, Home, Gamepad2, Tv, HeartPulse, Heart, Briefcase, GraduationCap, Smartphone, Zap, Coffee, Music, Plane, Book, Gift, Scissors, Check, Wifi, Dumbbell, TrendingUp, Camera, Baby, Dog, Shirt, Monitor, Landmark, Pill } from 'lucide-react';
import { cn } from '../lib/utils';

export const ICON_MAP = { Tag, ShoppingCart, Utensils, Car, Bus, Home, Gamepad2, Tv, HeartPulse, Heart, Briefcase, GraduationCap, Smartphone, Zap, Coffee, Music, Plane, Book, Gift, Scissors, Wifi, Dumbbell, TrendingUp, Camera, Baby, Dog, Shirt, Monitor, Landmark, Pill };
export const AVAILABLE_COLORS = [ { name: 'Cinza', hex: '#a1a1aa' }, { name: 'Roxo', hex: '#a855f7' }, { name: 'Verde', hex: '#10b981' }, { name: 'Vermelho', hex: '#ef4444' }, { name: 'Laranja', hex: '#f97316' }, { name: 'Amarelo', hex: '#f59e0b' }, { name: 'Azul', hex: '#3b82f6' }, { name: 'Rosa', hex: '#f43f5e' } ];

export default function Settings() {
  const { user, updatePassword, signOut, themeMode, setThemeMode, accentColor, setAccentColor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  
  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: '',
    salario_padrao: 4452.00,
    dia_virada: 1,
    ocultar_saldos: false,
    cor_destaque: 'emerald',
    notificar_vencimentos: false,
    dias_antecedencia: 3
  });

  const [newPassword, setNewPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState({ id: null, name: '', icon: 'Tag', color: '#a1a1aa' });
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileData) setProfile(profileData);
    const { data: catData } = await supabase.from('categories').select('*').or(`user_id.eq.${user.id},user_id.is.null`).order('name');
    if (catData) setCategories(catData);
    setLoading(false);
  };

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...profile });
    if (error) setProfileMessage('Erro ao salvar: ' + error.message);
    else {
      setProfileMessage('Configurações salvas!');
      setTimeout(() => setProfileMessage(''), 3000);
    }
    setSavingProfile(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMessage('Atualizando...');
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      setPwdMessage('Senha atualizada!');
      setNewPassword('');
    } catch (err) {
      setPwdMessage('Erro: ' + err.message);
    }
    setTimeout(() => setPwdMessage(''), 3000);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    
    // Identifica se estamos editando uma categoria global nativa
    const targetCat = categories.find(c => c.id === catForm.id);
    const isGlobal = targetCat && targetCat.user_id === null;
    
    const payload = {
      name: catForm.name,
      icon: catForm.icon,
      color: catForm.color,
      user_id: user.id
    };
    
    let errorObj = null;
    if (catForm.id && !isGlobal) {
      // É local e o usuário pode alterar
      const { error } = await supabase.from('categories').update(payload).eq('id', catForm.id);
      errorObj = error;
    } else {
      // Se for global, a edição apenas cria uma TÓPIA local na conta (clonagem)
      const { error } = await supabase.from('categories').insert([payload]);
      errorObj = error;
    }
    
    if (!errorObj) {
      setCatForm({ id: null, name: '', icone: 'Tag', cor: '#a1a1aa' });
      fetchData();
    } else {
      alert('Erro ao salvar categoria: ' + errorObj.message);
    }
  };

  const handleEditCatClick = (cat) => {
    setCatForm({
      id: cat.id,
      name: cat.name,
      icon: cat.icon || cat.icone || 'Tag',
      color: cat.color || cat.cor || '#a1a1aa'
    });
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return;
    
    // Verificadora Preventiva na tabela de Despesas
    const { data: linked, error: queryError } = await supabase.from('expenses').select('id').eq('category_id', cat.id).limit(1);
    
    if (queryError) {
      return alert("Erro ao checar despesas vinculadas: " + queryError.message);
    }
    
    if (linked && linked.length > 0) {
      return alert(`⚠️ Bloqueio Preventivo!\n\nVocê tem despesas usando a categoria "${cat.name}".\nVá na aba de Despesas e altere a categoria delas (ou exclua-as) para poder apagar esta categoria de forma segura.`);
    }

    // Tentar Excluir do Banco
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', cat.id);
    
    if (deleteError) {
       return alert(`❌ O Supabase bloqueou a exclusão!\n\nMotivo do Banco de Dados: ${deleteError.message}`);
    }

    fetchData();
  };

  const handleExportCSV = async () => {
    const { data: incomes } = await supabase.from('incomes').select('*, categories(name)').eq('user_id', user.id);
    const { data: expenses } = await supabase.from('expenses').select('*, categories(name)').eq('user_id', user.id);
    
    let csvData = 'Tipo;Data;Descrição;Categoria;Valor\n';
    
    incomes?.forEach(i => {
      const val = i.net_amount !== undefined ? i.net_amount : (i.gross_amount - (i.discounts||0));
      csvData += `Receita;${i.month};"${i.description}";${i.categories?.name || 'Geral'};${val.toString().replace('.',',')}\n`;
    });
    
    expenses?.forEach(e => {
      csvData += `Despesa;${e.expense_date};"${e.description}";${e.categories?.name || 'Geral'};${e.amount.toString().replace('.',',')}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleClearData = async () => {
    if (deleteConfirm !== 'CONFIRMAR LIMPEZA') return alert('Digite CONFIRMAR LIMPEZA para prosseguir.');
    setDangerLoading(true);
    await supabase.from('incomes').delete().eq('user_id', user.id);
    await supabase.from('expenses').delete().eq('user_id', user.id);
    setDangerLoading(false);
    setDeleteConfirm('');
    alert('Todos os lançamentos foram excluídos.');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETAR CONTA') return alert('Digite DELETAR CONTA para prosseguir.');
    if (window.confirm('Tem certeza ABSOLUTA? Esta ação é irreversível.')) {
      setDangerLoading(true);
      await supabase.rpc('delete_my_account');
      await signOut();
    }
  };

  if (loading) return <div className="text-muted p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary-glow">Configurações</h1>
        <p className="text-muted mt-1">Gerencie seu perfil, preferências e exporte dados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* PRIVACY & INTERFACE SECTION */}
        <section className="bg-surface/50 border border-border rounded-2xl p-6 md:col-span-2">
          <h2 className="text-xl font-semibold text-content flex items-center gap-2 mb-6"><Palette size={20} className="text-purple-400" /> Interface e Temas</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                 <h3 className="font-medium text-content mb-3 text-sm">Aparência do Aplicativo</h3>
                 <div className="flex bg-background/50 border border-border rounded-xl p-1 w-fit">
                    <button type="button" onClick={() => setThemeMode('dark')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", themeMode === 'dark' ? "bg-surface shadow-sm text-content border border-border/50" : "text-muted hover:text-content")}>
                       <Moon size={16}/> Escuro
                    </button>
                    <button type="button" onClick={() => setThemeMode('light')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", themeMode === 'light' ? "bg-surface shadow-sm text-content border border-border/50" : "text-muted hover:text-content")}>
                       <Sun size={16}/> Claro
                    </button>
                 </div>
               </div>

               <div>
                 <h3 className="font-medium text-content mb-3 text-sm">Cor de Destaque Global</h3>
                 <div className="flex flex-wrap gap-3">
                   {['emerald', 'blue', 'purple', 'rose', 'orange'].map(color => (
                     <button 
                       key={color} 
                       onClick={async () => {
                         setAccentColor(color);
                         setProfile(p => ({...p, cor_destaque: color}));
                         await supabase.from('profiles').upsert({ id: user.id, cor_destaque: color });
                       }}
                       className={`w-10 h-10 rounded-full border-2 transition-transform flex items-center justify-center ${accentColor === color ? 'border-primary scale-110 shadow-lg' : 'border-transparent hover:scale-105 shadow-sm'}`}
                       style={{
                         backgroundColor: color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : color === 'rose' ? '#f43f5e' : '#f97316'
                       }}
                       title={color === 'emerald' ? 'Padrão (Verde)' : color}
                     >
                       {accentColor === color && <div className="w-3 h-3 bg-white rounded-full opacity-60"></div>}
                     </button>
                   ))}
                 </div>
                 <p className="text-xs text-muted mt-2">Escolha a cor primária para botões, gráficos e destaques.</p>
               </div>
            </div>

            <div className="flex flex-col justify-center border-l-0 md:border-l border-t md:border-t-0 border-border pt-6 md:pt-0 md:pl-6">
              <h3 className="font-medium text-content mb-1">Modo Privacidade Global</h3>
              <p className="text-sm text-muted mb-4">Oculte os saldos com "R$ ****" por padrão ao abrir o aplicativo em locais públicos.</p>
              
              <label className="relative inline-flex items-center cursor-pointer w-fit">
                <input type="checkbox" name="ocultar_saldos" checked={profile.ocultar_saldos} onChange={async (e) => {
                  handleProfileChange(e);
                  await supabase.from('profiles').upsert({ id: user.id, ocultar_saldos: e.target.checked });
                }} className="sr-only peer" />
                <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        {/* PROFILE SECTION */}
        <section className="bg-surface/50 border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-content flex items-center gap-2"><User size={20} className="text-primary-glow" /> Perfil Básico</h2>
          </div>
          
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted">Email (Não editável)</label>
              <input type="text" disabled value={user.email} className="w-full bg-background/80 border border-border/50 rounded-xl px-4 py-2 text-muted cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted">Nome Completo</label>
              <input type="text" name="full_name" value={profile.full_name || ''} onChange={handleProfileChange} className="w-full bg-background/50 border border-border rounded-xl px-4 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted">URL da Foto de Perfil</label>
              <input type="url" name="avatar_url" value={profile.avatar_url || ''} onChange={handleProfileChange} className="w-full bg-background/50 border border-border rounded-xl px-4 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <button type="submit" disabled={savingProfile} className="w-full bg-border hover:bg-surface text-content font-medium py-2 rounded-xl transition-colors flex justify-center items-center gap-2">
              {savingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Perfil
            </button>
            {profileMessage && <p className="text-sm text-center text-primary-glow mt-2">{profileMessage}</p>}
          </form>

          <hr className="my-8 border-border" />

          <h3 className="text-lg font-medium text-content mb-4 flex items-center gap-2"><Lock size={18} className="text-muted" /> Alterar Senha</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
             <div className="space-y-2">
              <label className="text-sm text-muted">Nova Senha</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required className="w-full bg-background/50 border border-border rounded-xl px-4 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <button type="submit" className="w-full bg-border hover:bg-surface text-content font-medium py-2 rounded-xl transition-colors">Atualizar Senha</button>
            {pwdMessage && <p className="text-sm text-center text-muted mt-2">{pwdMessage}</p>}
          </form>
        </section>

        <div className="space-y-8">
          {/* FINANCIAL PREFS SECTION */}
          <section className="bg-surface/50 border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-content flex items-center gap-2 mb-6"><Wallet size={20} className="text-blue-400" /> Configurações Financeiras</h2>
            <form onSubmit={saveProfile} className="space-y-4">
               <div className="space-y-2">
                <label className="text-sm text-muted">Salário Base Padrão (R$)</label>
                <input type="number" step="0.01" name="salario_padrao" value={profile.salario_padrao} onChange={handleProfileChange} className="w-full bg-background/50 border border-border rounded-xl px-4 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted">Dia de Virada do Mês</label>
                <input type="number" min="1" max="31" name="dia_virada" value={profile.dia_virada} onChange={handleProfileChange} className="w-full bg-background/50 border border-border rounded-xl px-4 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <button type="submit" className="w-full bg-border hover:bg-surface text-content font-medium py-2 rounded-xl transition-colors">Salvar Configurações</button>
            </form>

            <hr className="my-8 border-border" />

            <h3 className="text-lg font-medium text-content mb-4 flex items-center justify-between">Gestão de Categorias <span className="text-xs font-normal text-muted bg-surface px-2 py-1 rounded border border-border">Total: {categories.length}</span></h3>
            
            {/* CURRENT CATEGORIES LIST */}
            <div className="bg-background/50 border border-border rounded-xl p-2 max-h-60 overflow-y-auto space-y-1 mb-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {categories.map(cat => {
                const IconComp = ICON_MAP[cat.icon] || ICON_MAP[cat.icone] || ICON_MAP['Tag'];
                const displayColor = cat.color || cat.cor || '#a1a1aa';
                return (
                  <div key={cat.id} className={cn("group flex justify-between items-center p-2 rounded-lg transition-colors border border-transparent", catForm.id === cat.id ? "bg-primary/5 border-primary/20" : "hover:bg-surface")}>
                     <span className="text-sm font-medium flex items-center gap-3">
                       <div className="p-1.5 rounded-lg bg-surface border shadow-sm flex items-center justify-center transition-colors" style={{ borderColor: `${displayColor}30` }}>
                          <IconComp size={16} style={{ color: displayColor }} />
                       </div>
                       <span style={{ color: displayColor }} className="drop-shadow-sm">{cat.name}</span>
                       {!cat.user_id && <span className="text-[10px] bg-border/50 uppercase tracking-wide px-1.5 py-0.5 rounded text-muted ml-1">Global</span>}
                     </span>
                     
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button type="button" onClick={() => handleEditCatClick(cat)} className="p-1.5 text-muted hover:text-cyan-400 rounded transition-colors"><Edit2 size={16} /></button>
                       {cat.user_id === user.id ? (
                         <button type="button" onClick={() => handleDeleteCategory(cat)} className="p-1.5 text-muted hover:text-rose-400 rounded transition-colors"><Trash2 size={16} /></button>
                       ) : (
                         <span className="p-1.5 text-muted/30" title="Categorias globais não podem ser excluídas"><Trash2 size={16}/></span>
                       )}
                     </div>
                  </div>
                );
              })}
            </div>

            {/* FORMULÁRIO DE CATEGORIA (BUILDER) */}
            <div className="bg-surface/80 border border-border rounded-xl p-4 md:p-5 relative overflow-hidden">
               {/* Decorative Gradient */}
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>

               <div className="flex items-center justify-between mb-4">
                 <h4 className="font-semibold text-content text-sm">{catForm.id ? 'Editar Categoria' : 'Criar Nova Categoria'}</h4>
                 {catForm.id && (
                   <button type="button" onClick={() => setCatForm({ id: null, name: '', icon: 'Tag', color: '#a1a1aa' })} className="text-xs font-medium text-muted hover:text-content flex items-center gap-1 transition-colors px-2 py-1 rounded bg-background border border-border"><X size={14}/> Cancelar</button>
                 )}
               </div>

               <form onSubmit={handleSaveCategory} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wide">Nome da Categoria</label>
                    <input type="text" placeholder="Ex: Viagens..." value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} required className="w-full bg-background/80 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-content focus:outline-none focus:border-primary/50 transition-all placeholder:text-zinc-600 shadow-inner" />
                  </div>

                  {/* Icon Picker */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wide mb-1 block">Ícone Visual</label>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 sm:gap-3 p-4 bg-background/50 border border-border/50 rounded-xl">
                      {Object.keys(ICON_MAP).map(key => {
                        const IconComponent = ICON_MAP[key];
                        if (!IconComponent) return null;
                        const isSelected = catForm.icon === key;
                        return (
                          <button 
                            key={key} type="button" 
                            onClick={() => setCatForm({...catForm, icon: key})}
                            className={cn("w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-2xl border flex items-center justify-center transition-all", isSelected ? "bg-primary/20 border-primary text-primary-glow shadow-md scale-110 z-10" : "bg-surface border-border/50 text-muted hover:text-content hover:bg-border/60")}
                            title={key}
                          >
                            <IconComponent size={24} strokeWidth={2} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Picker */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wide mb-1 block">Cor de Destaque</label>
                    <div className="flex flex-wrap gap-3 p-3 bg-background/50 border border-border/50 rounded-xl">
                      {AVAILABLE_COLORS.map(c => (
                        <button 
                          key={c.name} type="button"
                          onClick={() => setCatForm({...catForm, color: c.hex})}
                          className={cn("w-8 h-8 rounded-full border-2 transition-transform flex items-center justify-center", catForm.color === c.hex ? "scale-125 border-white shadow-md shadow-white/10 z-10" : "border-transparent hover:scale-110 shadow-sm opacity-80 hover:opacity-100")}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                           {catForm.color === c.hex && <Check size={14} className="text-white drop-shadow-md" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <button type="submit" className="w-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary-glow font-bold tracking-wide py-2.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm">
                      {catForm.id ? <Save size={18} /> : <Plus size={18} />} 
                      {catForm.id ? 'Salvar Edição' : 'Adicionar Categoria'}
                    </button>
                  </div>
               </form>
            </div>
          </section>

          {/* NOTIFICATION PREFS SECTION */}
          <section className="bg-surface/50 border border-border rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-content flex items-center gap-2 mb-6"><Bell size={20} className="text-amber-400" /> Notificações e Alertas</h2>
            <form onSubmit={saveProfile} className="space-y-4">
               <div>
                 <div className="flex items-center justify-between">
                   <span className="text-sm font-medium text-content flex-1 max-w-[80%]">Alertar vencimento de faturas e empréstimos</span>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input type="checkbox" name="notificar_vencimentos" checked={profile.notificar_vencimentos} onChange={handleProfileChange} className="sr-only peer" />
                     <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                   </label>
                 </div>
               </div>

               {profile.notificar_vencimentos && (
                 <div className="space-y-2 pt-2 border-t border-border/50 animate-in fade-in zoom-in duration-200">
                   <label className="text-sm text-muted">Avisar com quantos dias de antecedência?</label>
                   <input type="number" min="1" max="15" name="dias_antecedencia" value={profile.dias_antecedencia} onChange={handleProfileChange} className="w-full bg-background/50 border border-border rounded-xl px-4 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
                 </div>
               )}

               <button type="submit" className="w-full bg-border hover:bg-surface text-content font-medium py-2 rounded-xl transition-colors mt-2">Salvar Alertas</button>
            </form>
          </section>
        </div>

        {/* DANGER ZONE SECTION */}
        <section className="bg-red-950/10 md:col-span-2 border border-red-900/40 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-red-500 flex items-center gap-2 mb-6"><AlertTriangle size={20} /> Zona de Perigo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium text-content">Exportar Dados</h3>
              <p className="text-sm text-muted mb-3">Baixe um CSV com todas as suas transações (Formatado para Excel BR com ; e UTF-8).</p>
              <button onClick={handleExportCSV} className="bg-border hover:bg-surface text-content px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Download size={16} /> Baixar Extrato CSV
              </button>
            </div>
            <div className="border-t md:border-t-0 border-red-900/20 pt-6 md:pt-0">
              <h3 className="font-medium text-red-400">Ações Destrutivas</h3>
              <p className="text-sm text-muted mb-4">Estas ações não podem ser desfeitas. Confirme digitando abaixo:</p>
              <input type="text" placeholder='Ex: "CONFIRMAR LIMPEZA"' value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="w-full bg-background/50 border border-red-900/50 rounded-lg px-4 py-2 text-content focus:outline-none focus:border-red-500 mb-4 text-sm uppercase" />
              <div className="flex gap-3">
                <button onClick={handleClearData} disabled={dangerLoading || deleteConfirm !== 'CONFIRMAR LIMPEZA'} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Zerar Transações</button>
                <button onClick={handleDeleteAccount} disabled={dangerLoading || deleteConfirm !== 'DELETAR CONTA'} className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Excluir Conta</button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
