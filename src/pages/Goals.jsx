import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Target, Plus, Loader2, Trash2, TrendingUp, X, Check, Edit2 } from 'lucide-react';

export default function Goals() {
  const { user, showBalances } = useAuth();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalForm, setGoalForm] = useState({ name: '', target_amount: '', color: '#10b981' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [source, setSource] = useState('external');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setGoals(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount),
        color: goalForm.color
      };

      if (editingGoalId) {
        await supabase.from('goals').update(payload).eq('id', editingGoalId);
      } else {
        await supabase.from('goals').insert([{ user_id: user.id, current_amount: 0, ...payload }]);
      }
      
      closeGoalModal();
      fetchGoals();
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (goal) => {
    setEditingGoalId(goal.id);
    setGoalForm({
       name: goal.name, target_amount: goal.target_amount, color: goal.color
    });
    setShowGoalModal(true);
  };

  const closeGoalModal = () => {
    setShowGoalModal(false);
    setEditingGoalId(null);
    setGoalForm({ name: '', target_amount: '', color: '#10b981' });
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingDeposit(true);
    try {
      const amt = parseFloat(depositAmount);
      const newAmount = selectedGoal.current_amount + amt;
      await supabase.from('goals').update({ current_amount: newAmount }).eq('id', selectedGoal.id);

      if (source === 'balance') {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        await supabase.from('expenses').insert([{
           user_id: user.id,
           description: `Depósito: Caixinha ${selectedGoal.name}`,
           amount: amt,
           expense_date: d.toISOString().split('T')[0],
           status: 'paid'
        }]);
      }
      
      setShowDepositModal(false);
      setDepositAmount('');
      fetchGoals();
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Excluir esta meta? O histórico de depósitos (no seu balanço) não será revertido automaticamente.')) return;
    await supabase.from('goals').delete().eq('id', id);
    fetchGoals();
  };

  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12 w-full">
      <div className="flex justify-between items-center sm:items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Caixinhas & Metas</h1>
          <p className="text-zinc-400 mt-1 text-sm md:text-base">Guarde dinheiro para objetivos específicos</p>
        </div>
        <button onClick={() => setShowGoalModal(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg text-sm md:text-base">
          <Plus size={18} /> <span className="hidden sm:inline">Nova Meta</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-zinc-500"><Loader2 className="animate-spin" /></div>
      ) : goals.length === 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800/50 border-dashed rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center">
            <Target size={48} className="text-zinc-700 mb-4" />
            <p>Nenhuma meta financeira estabelecida.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(g => {
            const pct = Math.min((g.current_amount / g.target_amount) * 100, 100);
            return (
               <div key={g.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl" style={{backgroundColor: `${g.color}20`, color: g.color}}>
                         <Target size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-100">{g.name}</h3>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-zinc-950/50 rounded-lg p-1 border border-zinc-800/50">
                       <button onClick={() => handleEdit(g)} className="text-zinc-500 hover:text-emerald-400 transition-colors p-1.5 rounded-md hover:bg-zinc-800"><Edit2 size={16}/></button>
                       <button onClick={() => handleDelete(g.id)} className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-zinc-800"><Trash2 size={16}/></button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <div className="flex flex-col">
                         <span className="text-sm text-zinc-500 font-medium">Acumulado</span>
                         <span className="text-2xl font-bold text-zinc-100">{formatCurrency(g.current_amount)}</span>
                       </div>
                       <div className="text-right">
                         <span className="text-xs text-zinc-500 block mb-0.5">Objetivo Total</span>
                         <span className="text-sm font-semibold text-zinc-300">{formatCurrency(g.target_amount)}</span>
                       </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5 font-bold" style={{color: g.color}}>
                        <span>Progresso</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden shadow-inner border border-zinc-800/50">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: g.color }}>
                          <div className="absolute inset-0 bg-white/20"></div>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => { setSelectedGoal(g); setShowDepositModal(true); }} className="w-full py-2.5 mt-2 rounded-xl text-sm font-bold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-200 transition-colors flex items-center justify-center gap-2">
                       <TrendingUp size={16} /> Fazer Depósito
                    </button>
                  </div>
               </div>
            );
          })}
        </div>
      )}

      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-zinc-100">{editingGoalId ? 'Editar Caixinha' : 'Criar Nova Caixinha'}</h3>
                <button onClick={closeGoalModal} className="text-zinc-500 hover:text-zinc-200"><X size={20}/></button>
             </div>
             <form onSubmit={handleGoalSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Objetivo (Nome)</label>
                  <input type="text" placeholder="Ex: Viagem Europa, Carro..." value={goalForm.name} onChange={e=>setGoalForm({...goalForm, name: e.target.value})} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-100 focus:ring-1 focus:outline-none focus:ring-emerald-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Objetivo Financeiro</label>
                  <div className="relative flex items-center bg-zinc-950/50 border border-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-emerald-500/50">
                    <span className="pl-3 text-zinc-500">R$</span>
                    <input type="number" step="0.01" min="1" value={goalForm.target_amount} onChange={e=>setGoalForm({...goalForm, target_amount: e.target.value})} required className="w-full bg-transparent px-2 py-2.5 text-zinc-100 focus:outline-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-zinc-400">Cor Identificadora</label>
                  <input type="color" value={goalForm.color} onChange={e=>setGoalForm({...goalForm, color: e.target.value})} className="w-full h-10 rounded border-none bg-transparent cursor-pointer p-0 hover:opacity-80 transition-opacity" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold rounded-xl mt-4 flex justify-center shadow-lg shadow-emerald-500/20">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (editingGoalId ? 'Salvar Edição' : 'Salvar Objetivo')}
                </button>
             </form>
          </div>
        </div>
      )}

      {showDepositModal && selectedGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Fazer Depósito</h3>
                <button onClick={() => setShowDepositModal(false)} className="text-zinc-500 hover:text-zinc-200"><X size={20}/></button>
             </div>
             
             <div className="mb-4 text-center">
               <p className="text-zinc-400 text-sm">Destino</p>
               <p className="text-lg font-bold text-zinc-100">{selectedGoal.name}</p>
             </div>

             <form onSubmit={handleDepositSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400 font-medium">Quantia a guardar</label>
                  <div className="relative flex items-center bg-zinc-950/50 border border-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-emerald-500/50">
                    <span className="pl-3 text-zinc-500 text-lg">R$</span>
                    <input type="number" step="0.01" min="0.01" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} required className="w-full bg-transparent px-3 py-3 text-2xl font-bold text-emerald-400 focus:outline-none" />
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <label className="text-sm text-zinc-400 font-medium block">Origem do Dinheiro</label>
                  
                  <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${source === 'balance' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800'}`}>
                    <input type="radio" name="source" value="balance" checked={source === 'balance'} onChange={() => setSource('balance')} className="sr-only" />
                    <div className="flex items-start gap-3 w-full">
                       <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border ${source === 'balance' ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`}>
                          {source === 'balance' && <Check size={10} className="text-zinc-900" />}
                       </div>
                       <div>
                         <p className={`text-sm font-semibold ${source === 'balance' ? 'text-emerald-400' : 'text-zinc-300'}`}>Transferir do meu saldo vivo</p>
                         <p className="text-[10px] text-zinc-500 mt-1">Soma na meta e lança uma despesa no histórico para descontar do painel geral.</p>
                       </div>
                    </div>
                  </label>

                  <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${source === 'external' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800'}`}>
                    <input type="radio" name="source" value="external" checked={source === 'external'} onChange={() => setSource('external')} className="sr-only" />
                    <div className="flex items-start gap-3 w-full">
                       <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border ${source === 'external' ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`}>
                          {source === 'external' && <Check size={10} className="text-zinc-900" />}
                       </div>
                       <div>
                         <p className={`text-sm font-semibold ${source === 'external' ? 'text-emerald-400' : 'text-zinc-300'}`}>Saldo Anterior / Dinheiro Externo</p>
                         <p className="text-[10px] text-zinc-500 mt-1">Apenas acrescenta na meta e não altera lançamentos.</p>
                       </div>
                    </div>
                  </label>
                </div>

                <button type="submit" disabled={isSubmittingDeposit} className="w-full py-3.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold rounded-xl mt-4 shadow-lg flex justify-center transition-colors">
                  {isSubmittingDeposit ? <Loader2 className="animate-spin text-zinc-900" size={20} /> : 'Confirmar Depósito'}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
