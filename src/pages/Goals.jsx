import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Target, Plus, Loader2, Trash2, TrendingUp, X, Check, Edit2 } from 'lucide-react';

export default function Goals() {
  const { user, showBalances, activeGroupId } = useAuth();
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
    if (activeGroupId) {
       fetchGoals();
    }
  }, [user, activeGroupId]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('goals').select('*').eq('grupo_id', activeGroupId).order('created_at', { ascending: false });
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
        await supabase.from('goals').insert([{ user_id: user.id, grupo_id: activeGroupId, current_amount: 0, ...payload }]);
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
           grupo_id: activeGroupId,
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary-glow to-teal-400 bg-clip-text text-transparent">Caixinhas & Metas</h1>
          <p className="text-muted mt-1 text-sm md:text-base">Guarde dinheiro para objetivos específicos</p>
        </div>
        <button onClick={() => setShowGoalModal(true)} className="flex items-center gap-2 bg-primary hover:bg-primary-glow text-inverse font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg text-sm md:text-base">
          <Plus size={18} /> <span className="hidden sm:inline">Nova Meta</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-muted"><Loader2 className="animate-spin" /></div>
      ) : goals.length === 0 ? (
        <div className="bg-surface/30 border border-border/50 border-dashed rounded-2xl p-12 text-center text-muted flex flex-col items-center">
            <Target size={48} className="text-zinc-700 mb-4" />
            <p>Nenhuma meta financeira estabelecida.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(g => {
            const pct = Math.min((g.current_amount / g.target_amount) * 100, 100);
            return (
               <div key={g.id} className="bg-surface/60 border border-border rounded-2xl p-6 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl" style={{backgroundColor: `${g.color}20`, color: g.color}}>
                         <Target size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-content">{g.name}</h3>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-background/50 rounded-lg p-1 border border-border/50">
                       <button onClick={() => handleEdit(g)} className="text-muted hover:text-primary-glow transition-colors p-1.5 rounded-md hover:bg-border"><Edit2 size={16}/></button>
                       <button onClick={() => handleDelete(g.id)} className="text-muted hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-border"><Trash2 size={16}/></button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <div className="flex flex-col">
                         <span className="text-sm text-muted font-medium">Acumulado</span>
                         <span className="text-2xl font-bold text-content">{formatCurrency(g.current_amount)}</span>
                       </div>
                       <div className="text-right">
                         <span className="text-xs text-muted block mb-0.5">Objetivo Total</span>
                         <span className="text-sm font-semibold text-muted">{formatCurrency(g.target_amount)}</span>
                       </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5 font-bold" style={{color: g.color}}>
                        <span>Progresso</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3 overflow-hidden shadow-inner border border-border/50">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: g.color }}>
                          <div className="absolute inset-0 bg-white/20"></div>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => { setSelectedGoal(g); setShowDepositModal(true); }} className="w-full py-2.5 mt-2 rounded-xl text-sm font-bold bg-border hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-content transition-colors flex items-center justify-center gap-2">
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
          <div className="bg-surface border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-content">{editingGoalId ? 'Editar Caixinha' : 'Criar Nova Caixinha'}</h3>
                <button onClick={closeGoalModal} className="text-muted hover:text-content"><X size={20}/></button>
             </div>
             <form onSubmit={handleGoalSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted">Objetivo (Nome)</label>
                  <input type="text" placeholder="Ex: Viagem Europa, Carro..." value={goalForm.name} onChange={e=>setGoalForm({...goalForm, name: e.target.value})} required className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-content focus:ring-1 focus:outline-none focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted">Objetivo Financeiro</label>
                  <div className="relative flex items-center bg-background/50 border border-border rounded-lg focus-within:ring-1 focus-within:ring-primary/50">
                    <span className="pl-3 text-muted">R$</span>
                    <input type="number" step="0.01" min="1" value={goalForm.target_amount} onChange={e=>setGoalForm({...goalForm, target_amount: e.target.value})} required className="w-full bg-transparent px-2 py-2.5 text-content focus:outline-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-muted">Cor Identificadora</label>
                  <input type="color" value={goalForm.color} onChange={e=>setGoalForm({...goalForm, color: e.target.value})} className="w-full h-10 rounded border-none bg-transparent cursor-pointer p-0 hover:opacity-80 transition-opacity" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-primary hover:bg-primary-glow text-inverse font-bold rounded-xl mt-4 flex justify-center shadow-lg shadow-primary/20">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (editingGoalId ? 'Salvar Edição' : 'Salvar Objetivo')}
                </button>
             </form>
          </div>
        </div>
      )}

      {showDepositModal && selectedGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-primary-glow to-teal-400 bg-clip-text text-transparent">Fazer Depósito</h3>
                <button onClick={() => setShowDepositModal(false)} className="text-muted hover:text-content"><X size={20}/></button>
             </div>
             
             <div className="mb-4 text-center">
               <p className="text-muted text-sm">Destino</p>
               <p className="text-lg font-bold text-content">{selectedGoal.name}</p>
             </div>

             <form onSubmit={handleDepositSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted font-medium">Quantia a guardar</label>
                  <div className="relative flex items-center bg-background/50 border border-border rounded-lg focus-within:ring-1 focus-within:ring-primary/50">
                    <span className="pl-3 text-muted text-lg">R$</span>
                    <input type="number" step="0.01" min="0.01" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} required className="w-full bg-transparent px-3 py-3 text-2xl font-bold text-primary-glow focus:outline-none" />
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <label className="text-sm text-muted font-medium block">Origem do Dinheiro</label>
                  
                  <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${source === 'balance' ? 'border-primary/50 bg-primary/10' : 'border-border bg-background/50 hover:bg-border'}`}>
                    <input type="radio" name="source" value="balance" checked={source === 'balance'} onChange={() => setSource('balance')} className="sr-only" />
                    <div className="flex items-start gap-3 w-full">
                       <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border ${source === 'balance' ? 'border-primary bg-primary' : 'border-zinc-600'}`}>
                          {source === 'balance' && <Check size={10} className="text-inverse" />}
                       </div>
                       <div>
                         <p className={`text-sm font-semibold ${source === 'balance' ? 'text-primary-glow' : 'text-muted'}`}>Transferir do meu saldo vivo</p>
                         <p className="text-[10px] text-muted mt-1">Soma na meta e lança uma despesa no histórico para descontar do painel geral.</p>
                       </div>
                    </div>
                  </label>

                  <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${source === 'external' ? 'border-primary/50 bg-primary/10' : 'border-border bg-background/50 hover:bg-border'}`}>
                    <input type="radio" name="source" value="external" checked={source === 'external'} onChange={() => setSource('external')} className="sr-only" />
                    <div className="flex items-start gap-3 w-full">
                       <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border ${source === 'external' ? 'border-primary bg-primary' : 'border-zinc-600'}`}>
                          {source === 'external' && <Check size={10} className="text-inverse" />}
                       </div>
                       <div>
                         <p className={`text-sm font-semibold ${source === 'external' ? 'text-primary-glow' : 'text-muted'}`}>Saldo Anterior / Dinheiro Externo</p>
                         <p className="text-[10px] text-muted mt-1">Apenas acrescenta na meta e não altera lançamentos.</p>
                       </div>
                    </div>
                  </label>
                </div>

                <button type="submit" disabled={isSubmittingDeposit} className="w-full py-3.5 bg-zinc-100 hover:bg-white text-inverse font-bold rounded-xl mt-4 shadow-lg flex justify-center transition-colors">
                  {isSubmittingDeposit ? <Loader2 className="animate-spin text-inverse" size={20} /> : 'Confirmar Depósito'}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
