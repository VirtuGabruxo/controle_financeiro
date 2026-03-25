import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CreditCard, Loader2, Trash2 } from 'lucide-react';

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [installments, setInstallments] = useState(1);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      setCategories(catData || []);
      if (catData && catData.length > 0 && !categoryId) setCategoryId(catData[0].id);

      const { data: expData } = await supabase
        .from('expenses')
        .select('*, categories(*)')
        .order('expense_date', { ascending: false })
        .limit(50);
      setExpenses(expData || []);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const baseDate = new Date(date);
      // workaround for correct timezone addition for JS dates
      baseDate.setMinutes(baseDate.getMinutes() + baseDate.getTimezoneOffset());
      
      const generatedGroupId = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36);
      const inserts = [];
      const installmentCount = parseInt(installments, 10) || 1;
      const amountPerInstallment = parseFloat(amount || 0);

      for (let i = 0; i < installmentCount; i++) {
        const instDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        
        // Formata data correta local
        const localDateIso = new Date(instDate.getTime() - (instDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);

        inserts.push({
          user_id: user.id,
          category_id: categoryId,
          description: installmentCount > 1 ? `${description} (${i + 1}/${installmentCount})` : description,
          amount: amountPerInstallment,
          expense_date: localDateIso,
          installment_current: i + 1,
          installment_total: installmentCount,
          group_id: generatedGroupId
        });
      }

      const { error } = await supabase.from('expenses').insert(inserts);
      if (error) throw error;
      
      setDescription('');
      setAmount('');
      setInstallments(1);
      fetchData();
    } catch (error) {
      alert('Erro ao salvar despesa: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (id) => {
    if(!window.confirm('Deseja excluir? Se parcela, apenas esta será removida.')) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchData();
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateString) => {
    const d = new Date(dateString);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR').format(d);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Minhas Despesas</h1>
        <p className="text-zinc-400 mt-1">Registre gastos e acompanhe faturas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 h-fit">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-6 text-zinc-100">
            <CreditCard className="text-rose-400" /> Novo Gasto
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Descrição</label>
              <input type="text" required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Valor Parcela (R$)</label>
              <input type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm text-zinc-300">Data</label>
                 <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm text-zinc-300">Parcelas</label>
                 <input type="number" min="1" max="72" required value={installments} onChange={e => setInstallments(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50" />
               </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Categoria</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 appearance-none">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-rose-500 hover:bg-rose-600 text-zinc-50 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 mt-4">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Registrar</>}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100">Histórico Recente</h2>
          {loading ? <div className="text-zinc-400">Carregando...</div> : expenses.length === 0 ? <div className="p-8 text-center text-zinc-500 border border-zinc-800/50 border-dashed rounded-2xl">Vazio.</div> : (
            <div className="grid gap-3">
              {expenses.map(exp => (
                <div key={exp.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center hover:border-rose-500/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-900 font-bold text-sm" style={{ backgroundColor: exp.categories?.color || '#555' }}>
                      {exp.categories?.name?.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-100">{exp.description}</p>
                      <div className="flex gap-2 text-xs">
                        <span className="text-zinc-400">{formatDate(exp.expense_date)}</span>
                        <span className="text-zinc-500 px-1 bg-zinc-800 rounded">{exp.categories?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="text-right">
                       <p className="text-lg font-bold text-rose-400">{formatCurrency(exp.amount)}</p>
                       {exp.installment_total > 1 && <p className="text-xs text-zinc-500">{exp.installment_current}/{exp.installment_total}</p>}
                     </div>
                     <button onClick={() => handleDelete(exp.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={18} /></button>
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
