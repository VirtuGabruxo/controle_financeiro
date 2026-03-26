import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, DollarSign, Loader2, Trash2, Edit2, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Incomes() {
  const { user, showBalances } = useAuth();
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const getLocalDateIso = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 7) + '-01';
  };

  const [month, setMonth] = useState(getLocalDateIso());
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Salário');
  const [grossAmount, setGrossAmount] = useState('');
  const [discounts, setDiscounts] = useState('');

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
      const payload = {
        user_id: user.id,
        month: month,
        description: description,
        type: type,
        gross_amount: parseFloat(grossAmount || 0),
        discounts: parseFloat(discounts || 0),
        // Se a coluna overtime_amount ainda existir na DB sem default, melhor passar '0'
        overtime_amount: 0
      };

      if (editingId) {
        const { error } = await supabase.from('incomes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('incomes').insert([payload]);
        if (error) throw error;
      }
      
      handleCancelEdit();
      fetchIncomes();
    } catch (error) {
      alert('Erro ao salvar renda: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEdit = (inc) => {
     setEditingId(inc.id);
     setMonth(inc.month);
     setDescription(inc.description || '');
     setType(inc.type || 'Salário');
     setGrossAmount(inc.gross_amount.toString());
     setDiscounts((inc.discounts || 0).toString());
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
     setEditingId(null);
     setDescription('');
     setGrossAmount('');
     setDiscounts('');
     setType('Salário');
     // Maintain active month string
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Tem certeza em excluir esta renda?')) return;
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (!error) fetchIncomes();
  };

  const formatCurrency = (value) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'R$ ****';
  const formatMonthHeader = (dateString) => {
    const d = new Date(dateString);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
  };

  // Agrupamento por mês
  const groupedIncomes = incomes.reduce((acc, income) => {
    if (!acc[income.month]) {
      acc[income.month] = { total: 0, items: [] };
    }
    acc[income.month].items.push(income);
    // Supabase devolve o net_amount (se trigger configurada), mas por segurança calcularemos:
    const net = income.net_amount !== undefined ? income.net_amount : (income.gross_amount - (income.discounts || 0));
    acc[income.month].total += net;
    return acc;
  }, {});

  const sortedMonths = Object.keys(groupedIncomes).sort((a, b) => new Date(b) - new Date(a));
  
  // Cálculo em Tempo Real
  const estimatedNet = parseFloat(grossAmount || 0) - parseFloat(discounts || 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Minhas Rendas</h1>
        <p className="text-zinc-400 mt-1">Gerencie seus salários e todas as suas fontes de receita extra.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulário */}
        <div className="lg:col-span-1 bg-zinc-900 lg:bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-5 md:p-6 h-fit relative lg:sticky lg:top-6 z-10 shadow-xl lg:shadow-none">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
               <DollarSign className="text-emerald-400" /> {editingId ? 'Editar Renda' : 'Nova Renda'}
             </h2>
             {editingId && (
               <button type="button" onClick={handleCancelEdit} className="text-xs text-zinc-500 hover:text-zinc-300">Cancelar</button>
             )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
               <label className="text-sm font-medium text-zinc-300">Tipo de Renda</label>
               <div className="grid grid-cols-3 gap-2">
                 {['Salário', 'Extra', 'Bônus'].map(t => (
                   <button
                     key={t}
                     type="button"
                     onClick={() => setType(t)}
                     className={cn(
                       "py-2 px-3 text-xs md:text-sm font-medium rounded-xl border transition-all text-center",
                       type === t 
                         ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                         : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                     )}
                   >
                     {t}
                   </button>
                 ))}
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Descrição</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Salário Empresa X" required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Mês de Referência</label>
              <input type="date" required value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Valor Bruto</label>
                <div className="relative flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
                  <span className="pl-4 text-zinc-500 font-medium">R$</span>
                  <input type="number" min="0" step="0.01" required value={grossAmount} onChange={e => setGrossAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-2.5 text-zinc-100 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Descontos</label>
                <div className="relative flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
                  <span className="pl-4 text-zinc-500 font-medium">R$</span>
                  <input type="number" min="0" step="0.01" value={discounts} onChange={e => setDiscounts(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-2.5 text-zinc-100 focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-zinc-800">
               <div className="flex flex-col text-sm bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                 <span className="text-zinc-400 mb-1">Total Líquido Estimado</span>
                 <span className="text-2xl font-bold text-emerald-400">{formatCurrency(estimatedNet)}</span>
               </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4">
               {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                 <>
                   {editingId ? <Edit2 size={18} /> : <Plus size={20} />}
                   {editingId ? 'Salvar Alterações' : 'Adicionar Renda'}
                 </>
               )}
            </button>
          </form>
        </div>

        {/* Histórico Agrupado */}
        <div className="lg:col-span-2 space-y-8">
          {loading ? (
             <div className="text-zinc-400 flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando histórico...</div>
          ) : incomes.length === 0 ? (
             <div className="bg-zinc-900/30 border border-zinc-800/50 border-dashed rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center">
                <DollarSign size={48} className="text-zinc-700 mb-4" />
                <p>Nenhuma renda cadastrada.</p>
                <p className="text-sm">Comece a adicionar suas receitas no formulário.</p>
             </div>
          ) : (
             <div className="space-y-8">
               {sortedMonths.map(monthKey => {
                 const monthGroup = groupedIncomes[monthKey];
                 return (
                   <div key={monthKey} className="space-y-4">
                     {/* Month Header */}
                     <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                       <h3 className="text-xl font-semibold text-zinc-100 capitalize flex items-center gap-2">
                         <Calendar className="text-emerald-400" size={20} />
                         {formatMonthHeader(monthKey)}
                       </h3>
                       <div className="text-right">
                         <span className="text-sm text-zinc-500 block">Total Líquido</span>
                         <span className="text-lg font-bold text-emerald-400">{formatCurrency(monthGroup.total)}</span>
                       </div>
                     </div>

                     {/* Income Cards */}
                     <div className="grid gap-3">
                       {monthGroup.items.map(inc => {
                         const liq = inc.net_amount !== undefined ? inc.net_amount : (inc.gross_amount - (inc.discounts || 0));
                         return (
                           <div key={inc.id} className={cn(
                             "bg-zinc-900/40 border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-emerald-500/30",
                             editingId === inc.id ? "border-emerald-500/50 ring-1 ring-emerald-500/50" : "border-zinc-800"
                           )}>
                             <div className="flex-1">
                               <div className="flex items-center gap-3 mb-2">
                                 <span className={cn(
                                   "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                   inc.type === 'Salário' ? "bg-blue-500/20 text-blue-400" :
                                   inc.type === 'Extra' ? "bg-orange-500/20 text-orange-400" :
                                   "bg-purple-500/20 text-purple-400"
                                 )}>
                                   {inc.type || 'Salário'}
                                 </span>
                                 <p className="font-semibold text-zinc-100">{inc.description || 'Renda sem descrição'}</p>
                               </div>
                               <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm">
                                 <span className="text-zinc-400 flex items-center gap-1">Bruto: <span className="text-zinc-200">{formatCurrency(inc.gross_amount)}</span></span>
                                 {inc.discounts > 0 && <span className="text-red-400/80 flex items-center gap-1">Desc: <span>{formatCurrency(inc.discounts)}</span></span>}
                               </div>
                             </div>

                             <div className="flex items-center justify-between md:justify-end gap-6 border-t border-zinc-800/50 md:border-0 pt-4 md:pt-0 mt-2 md:mt-0">
                               <div className="text-left md:text-right flex flex-col items-start md:items-end">
                                 <span className="text-xs text-zinc-500">Líquido</span>
                                 <span className="text-xl font-bold text-emerald-400">{formatCurrency(liq)}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <button onClick={() => handleEdit(inc)} className="text-zinc-500 hover:text-emerald-400 p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/50 transition-colors" title="Editar">
                                   <Edit2 size={16} />
                                 </button>
                                 <button onClick={() => handleDelete(inc.id)} className="text-zinc-500 hover:text-red-400 p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/50 transition-colors" title="Excluir">
                                   <Trash2 size={16} />
                                 </button>
                               </div>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
