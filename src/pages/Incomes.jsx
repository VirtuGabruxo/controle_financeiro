import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, DollarSign, Loader2, Trash2 } from 'lucide-react';

export default function Incomes() {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [grossAmount, setGrossAmount] = useState('');
  const [discounts, setDiscounts] = useState('');
  const [overtime, setOvertime] = useState('');

  useEffect(() => {
    fetchIncomes();
  }, [user]);

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .order('month', { ascending: false });
        
      if (error) throw error;
      setIncomes(data || []);
    } catch (error) {
      console.error('Error fetching incomes:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('incomes').insert([{
        user_id: user.id,
        month: month,
        gross_amount: parseFloat(grossAmount || 0),
        discounts: parseFloat(discounts || 0),
        overtime_amount: parseFloat(overtime || 0)
      }]);

      if (error) throw error;
      
      setGrossAmount('');
      setDiscounts('');
      setOvertime('');
      fetchIncomes();
    } catch (error) {
      alert('Erro ao salvar renda: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (id) => {
    if(!window.confirm('Tem certeza em excluir esta renda?')) return;
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (!error) fetchIncomes();
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(dateString));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Minhas Rendas</h1>
        <p className="text-zinc-400 mt-1">Gerencie seus salários e receitas extras</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 h-fit">
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 mb-6">
            <DollarSign className="text-emerald-400" /> Nova Renda
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Mês de Referência</label>
              <input type="date" required value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Valor Bruto (R$)</label>
              <input type="number" min="0" step="0.01" required value={grossAmount} onChange={e => setGrossAmount(e.target.value)} placeholder="Ex: 4500.00" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Descontos (R$)</label>
              <input type="number" min="0" step="0.01" value={discounts} onChange={e => setDiscounts(e.target.value)} placeholder="Ex: 350.00" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Horas Extras / Bônus (R$)</label>
              <input type="number" min="0" step="0.01" value={overtime} onChange={e => setOvertime(e.target.value)} placeholder="Ex: 150.00" className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div className="pt-4 mt-2 border-t border-zinc-800">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-zinc-400">Total Líquido Estimado</span>
                 <span className="font-bold text-emerald-400">{formatCurrency((parseFloat(grossAmount || 0)) - (parseFloat(discounts || 0)) + (parseFloat(overtime || 0)))}</span>
               </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Adicionar Renda</>}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100">Histórico de Rendas</h2>
          {loading ? <div className="text-zinc-400">Carregando...</div> : incomes.length === 0 ? <div className="bg-zinc-900/30 border border-zinc-800/50 border-dashed rounded-2xl p-8 text-center text-zinc-500">Nenhuma renda cadastrada.</div> : (
            <div className="grid gap-3">
              {incomes.map(inc => (
                <div key={inc.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-zinc-100 capitalize">{formatDate(inc.month)}</p>
                    <div className="flex gap-4 mt-1 text-xs text-zinc-400">
                      <span>Bruto: {formatCurrency(inc.gross_amount)}</span>
                      <span className="text-red-400/80">Desc: {formatCurrency(inc.discounts)}</span>
                      <span className="text-emerald-400/80">Extra: {formatCurrency(inc.overtime_amount)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <span className="text-lg font-bold text-emerald-400">{formatCurrency(inc.net_amount)}</span>
                     <button onClick={() => handleDelete(inc.id)} className="text-zinc-500 hover:text-red-400 p-2"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
