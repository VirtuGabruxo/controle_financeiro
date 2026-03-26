import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, User, Lock, Download, AlertTriangle, Shield, Palette, Wallet, Trash2, Loader2, Plus, Moon, Sun, Bell } from 'lucide-react';
import { cn } from '../lib/utils';

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
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileData) setProfile(profileData);
    const { data: catData } = await supabase.from('categories').select('*').order('name');
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

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from('categories').insert([{
      name: newCategoryName,
      user_id: user.id,
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    }]);
    if (!error) {
      setNewCategoryName('');
      fetchData();
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Tem certeza? Isso pode afetar transações existentes.')) return;
    await supabase.from('categories').delete().eq('id', id);
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

            <h3 className="text-lg font-medium text-content mb-4">Gestão de Categorias</h3>
            <div className="bg-background/50 border border-border rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 mb-4">
              {categories.map(cat => (
                <div key={cat.id} className="flex justify-between items-center group">
                   <span className="text-sm text-muted flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}}></div>
                     {cat.name} {!cat.user_id && <span className="text-xs bg-border px-1 rounded text-muted">Global</span>}
                   </span>
                   {cat.user_id === user.id && (
                     <button onClick={() => handleDeleteCategory(cat.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                   )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2">
               <input type="text" placeholder="Nova categoria..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-1.5 text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/50" />
               <button type="submit" className="bg-border hover:bg-surface px-3 py-1.5 rounded-lg text-primary-glow"><Plus size={18} /></button>
            </form>
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
