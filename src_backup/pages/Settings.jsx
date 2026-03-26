import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, User, Lock, Download, AlertTriangle, Shield, Palette, Wallet, Trash2, Loader2, Plus } from 'lucide-react';

export default function Settings() {
  const { user, updatePassword, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  
  // Profile & Preferences State
  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: '',
    salario_padrao: 4452.00,
    dia_virada: 1,
    ocultar_saldos: false,
    cor_destaque: 'emerald'
  });

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');

  // Categories State
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Danger Zone State
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch Categories
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (catData) setCategories(catData);

    setLoading(false);
  };

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...profile
      });
      
    if (error) {
      setProfileMessage('Erro ao salvar: ' + error.message);
    } else {
      setProfileMessage('Configurações salvas com sucesso!');
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
      setPwdMessage('Senha atualizada com sucesso!');
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
      user_id: user.id, // Only user specific categories
      color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color for now
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
    // Fetch user incomes and expenses
    const { data: incomes } = await supabase.from('incomes').select('*, categories(name)').eq('user_id', user.id);
    const { data: expenses } = await supabase.from('expenses').select('*, categories(name)').eq('user_id', user.id);
    
    const headers = 'Tipo,Data,Descrição,Categoria,Valor\n';
    let csvData = headers;
    
    incomes?.forEach(i => {
      csvData += `Receita,${i.income_date},"${i.description}",${i.categories?.name || ''},${i.amount}\n`;
    });
    expenses?.forEach(e => {
      csvData += `Despesa,${e.expense_date},"${e.description}",${e.categories?.name || ''},${e.amount}\n`;
    });

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleClearData = async () => {
    if (deleteConfirm !== 'CONFIRMAR LIMPEZA') {
      alert('Digite CONFIRMAR LIMPEZA para prosseguir.');
      return;
    }
    setDangerLoading(true);
    await supabase.from('incomes').delete().eq('user_id', user.id);
    await supabase.from('expenses').delete().eq('user_id', user.id);
    setDangerLoading(false);
    setDeleteConfirm('');
    alert('Todos os lançamentos foram excluídos.');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETAR CONTA') {
      alert('Digite DELETAR CONTA para prosseguir.');
      return;
    }
    if (window.confirm('Tem certeza ABSOLUTA? Esta ação é irreversível.')) {
      setDangerLoading(true);
      await supabase.rpc('delete_my_account');
      await signOut();
    }
  };

  if (loading) return <div className="text-zinc-400 p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-emerald-400">Configurações</h1>
        <p className="text-zinc-400 mt-1">Gerencie seu perfil, preferências e exporte dados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* PROFILE SECTION */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2"><User size={20} className="text-emerald-400" /> Perfil Básico</h2>
          </div>
          
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Email (Não editável)</label>
              <input type="text" disabled value={user.email} className="w-full bg-zinc-950/80 border border-zinc-800/50 rounded-xl px-4 py-2 text-zinc-500 cursor-not-allowed" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Nome Completo</label>
              <input type="text" name="full_name" value={profile.full_name || ''} onChange={handleProfileChange} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">URL da Foto de Perfil (Opcional)</label>
              <input type="url" name="avatar_url" value={profile.avatar_url || ''} onChange={handleProfileChange} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <button type="submit" disabled={savingProfile} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium py-2 rounded-xl transition-colors flex justify-center items-center gap-2">
              {savingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Perfil
            </button>
            {profileMessage && <p className="text-sm text-center text-emerald-400 mt-2">{profileMessage}</p>}
          </form>

          <hr className="my-8 border-zinc-800" />

          <h3 className="text-lg font-medium text-zinc-200 mb-4 flex items-center gap-2"><Lock size={18} className="text-zinc-400" /> Alterar Senha</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
             <div className="space-y-2">
              <label className="text-sm text-zinc-300">Nova Senha</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium py-2 rounded-xl transition-colors">
              Atualizar Senha
            </button>
            {pwdMessage && <p className="text-sm text-center text-zinc-400 mt-2">{pwdMessage}</p>}
          </form>
        </section>

        {/* FINANCIAL PREFS SECTION */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-6"><Wallet size={20} className="text-blue-400" /> Configurações Financeiras</h2>
          
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Salário Base Padrão (R$)</label>
              <input type="number" step="0.01" name="salario_padrao" value={profile.salario_padrao} onChange={handleProfileChange} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Dia de Virada do Mês</label>
              <input type="number" min="1" max="31" name="dia_virada" value={profile.dia_virada} onChange={handleProfileChange} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium py-2 rounded-xl transition-colors">
              Salvar Configurações
            </button>
          </form>

          <hr className="my-8 border-zinc-800" />

          <h3 className="text-lg font-medium text-zinc-200 mb-4">Gestão de Categorias</h3>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 mb-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex justify-between items-center group">
                 <span className="text-sm text-zinc-300 flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}}></div>
                   {cat.name} 
                   {!cat.user_id && <span className="text-xs bg-zinc-800 px-1 rounded text-zinc-500">Global</span>}
                 </span>
                 {cat.user_id === user.id && (
                   <button onClick={() => handleDeleteCategory(cat.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={16} />
                   </button>
                 )}
              </div>
            ))}
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2">
             <input type="text" placeholder="Nova categoria..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
             <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-emerald-400"><Plus size={18} /></button>
          </form>

        </section>

        {/* PRIVACY & INTERFACE SECTION */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-6"><Shield size={20} className="text-purple-400" /> Interface e Privacidade</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-zinc-200">Modo Privacidade</h3>
                <p className="text-sm text-zinc-500">Ocultar saldos por padrão ao abrir o app</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="ocultar_saldos" checked={profile.ocultar_saldos} onChange={async (e) => {
                  handleProfileChange(e);
                  await supabase.from('profiles').upsert({ id: user.id, ocultar_saldos: e.target.checked });
                }} className="sr-only peer" />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div>
               <h3 className="font-medium text-zinc-200 flex items-center gap-2 mb-3"><Palette size={18} /> Cor de Destaque</h3>
               <div className="flex gap-3">
                 {['emerald', 'blue', 'purple', 'rose', 'orange'].map(color => (
                   <button 
                     key={color} 
                     onClick={async () => {
                       setProfile(p => ({...p, cor_destaque: color}));
                       await supabase.from('profiles').upsert({ id: user.id, cor_destaque: color });
                     }}
                     className={`w-8 h-8 rounded-full border-2 transition-all ${profile.cor_destaque === color ? 'border-zinc-100 scale-110' : 'border-transparent hover:scale-105'}`}
                     style={{
                       backgroundColor: 
                         color === 'emerald' ? '#34d399' : 
                         color === 'blue' ? '#60a5fa' : 
                         color === 'purple' ? '#a78bfa' : 
                         color === 'rose' ? '#fb7185' : '#fb923c'
                     }}
                     title={color}
                   />
                 ))}
               </div>
            </div>
          </div>
        </section>

        {/* DANGER ZONE SECTION */}
        <section className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-red-500 flex items-center gap-2 mb-6"><AlertTriangle size={20} /> Zona de Perigo</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-zinc-200">Exportar Dados</h3>
              <p className="text-sm text-zinc-500 mb-3">Baixe um CSV com todas as suas transações.</p>
              <button onClick={handleExportCSV} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Download size={16} /> Baixar CSV
              </button>
            </div>

            <hr className="border-red-900/30" />

            <div>
              <h3 className="font-medium text-red-400">Ações Destrutivas</h3>
              <p className="text-sm text-zinc-400 mb-4">Estas ações não podem ser desfeitas. Confirme digitando abaixo:</p>
              
              <input 
                type="text" 
                placeholder='Ex: "CONFIRMAR LIMPEZA"' 
                value={deleteConfirm} 
                onChange={e => setDeleteConfirm(e.target.value)} 
                className="w-full bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-red-500 mb-4 text-sm uppercase" 
              />

              <div className="flex gap-3">
                <button 
                   onClick={handleClearData}
                   disabled={dangerLoading || deleteConfirm !== 'CONFIRMAR LIMPEZA'}
                   className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Zerar Transações
                </button>
                <button 
                   onClick={handleDeleteAccount}
                   disabled={dangerLoading || deleteConfirm !== 'DELETAR CONTA'}
                   className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
