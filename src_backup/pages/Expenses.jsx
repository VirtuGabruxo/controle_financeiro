import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CreditCard, Loader2, Trash2, Edit2, Calendar, ChevronLeft, ChevronRight, CheckCircle2, Circle, Settings2, X, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Expenses() {
  const { user, showBalances } = useAuth();
  
  // States
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  
  const getLocalDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d;
  };
  const [currentMonth, setCurrentMonth] = useState(getLocalDate());
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'debit', or card_id
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [cardId, setCardId] = useState('debit'); 
  const [installments, setInstallments] = useState('1');
  const [isRecurring, setIsRecurring] = useState(false);

  // Card Manager Modal State
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardForm, setCardForm] = useState({ name: '', color: '#6366f1', closing_day: 15, due_day: 20, credit_limit: '' });
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  useEffect(() => {
    fetchCoreData();
  }, [user]);

  useEffect(() => {
    fetchExpenses();
  }, [user, currentMonth]);

  const fetchCoreData = async () => {
    const { data: catData } = await supabase.from('categories').select('*').order('name');
    if (catData) setCategories(catData);
    
    const { data: cardData } = await supabase.from('cards').select('*').order('name');
    if (cardData) setCards(cardData);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
      const startDay = `${year}-${monthStr}-01T00:00:00`;
      const lastDayNum = new Date(year, currentMonth.getMonth() + 1, 0).getDate();
      const endDay = `${year}-${monthStr}-${lastDayNum}T23:59:59`;

      // Se a query reclamar de relations, lembre que o Supabase resolve relations nativamente pelas Foreign Keys definidas
      const { data, error } = await supabase
        .from('expenses')
        .select(`*, categories(name, color), cards(*)`)
        .gte('expense_date', startDay)
        .lte('expense_date', endDay)
        .order('expense_date', { ascending: false });
        
      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount || !categoryId || !expenseDate) return;
    setIsSubmitting(true);
    
    try {
      const payloadBase = {
        user_id: user.id,
        category_id: categoryId,
        card_id: cardId === 'debit' ? null : cardId,
        is_recurring: isRecurring,
        status: 'pending' // Default status
      };

      if (editingId) {
        // Editar não afeta parcelas projetadas, apenas a unidade selecionada
        await supabase.from('expenses').update({
          ...payloadBase,
          description,
          amount: parseFloat(amount),
          expense_date: expenseDate,
        }).eq('id', editingId);
      } else {
        const qty = isRecurring ? 24 : parseInt(installments || '1');
        const baseAmount = isRecurring ? parseFloat(amount) : (parseFloat(amount) / qty);
        
        const payloads = [];
        let d = new Date(`${expenseDate}T12:00:00`); 
        
        for(let i=0; i < qty; i++) {
          payloads.push({
            ...payloadBase,
            description: qty > 1 && !isRecurring ? `${description} (${i+1}/${qty})` : description,
            amount: baseAmount,
            expense_date: d.toISOString().split('T')[0],
            // As colunas installment nativas talvez não existam, o texto já resolve a UI.
          });
          d.setMonth(d.getMonth() + 1);
        }
        await supabase.from('expenses').insert(payloads);
      }
      
      handleCancelEdit();
      fetchExpenses();
    } catch (error) {
      alert('Erro ao salvar despesa: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingCard(true);
    try {
      const { error } = await supabase.from('cards').insert([{
        user_id: user.id,
        name: cardForm.name,
        color: cardForm.color,
        closing_day: parseInt(cardForm.closing_day),
        due_day: parseInt(cardForm.due_day),
        credit_limit: parseFloat(cardForm.credit_limit || 0)
      }]);
      if (error) throw error;
      setShowCardModal(false);
      setCardForm({ name: '', color: '#6366f1', closing_day: 15, due_day: 20, credit_limit: '' });
      fetchCoreData();
    } catch (error) {
      alert('Erro ao salvar cartão!');
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const toggleStatus = async (exp) => {
     const newStatus = exp.status === 'paid' ? 'pending' : 'paid';
     const { error } = await supabase.from('expenses').update({ status: newStatus }).eq('id', exp.id);
     if (!error) {
        setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: newStatus } : e));
     }
  };

  const handleEdit = (exp) => {
    setEditingId(exp.id);
    setDescription(exp.description || '');
    setAmount(exp.amount.toString());
    setExpenseDate(exp.expense_date);
    setCategoryId(exp.category_id || '');
    setCardId(exp.card_id || 'debit');
    setIsRecurring(exp.is_recurring || false);
    setInstallments('1'); // Block editing multiple instantly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setInstallments('1');
    setIsRecurring(false);
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Excluir esta despesa permanentemente?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) fetchExpenses();
  };

  // Nav actions
  const goPrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  // Formatters
  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth);

  // Derivations
  const filteredList = expenses.filter(e => activeTab === 'all' || (activeTab === 'debit' && !e.card_id) || e.card_id === activeTab);
  
  // Card Summaries (Map invoices)
  const invoices = cards.map(c => {
    const total = expenses.filter(e => e.card_id === c.id).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const pct = c.credit_limit > 0 ? Math.min((total / c.credit_limit) * 100, 100) : 0;
    return { ...c, invoiceTotal: total, pct };
  });
  const debitTotal = expenses.filter(e => !e.card_id).reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto w-full pb-12">
      
      {/* Top Bar Month Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Minhas Despesas</h1>
          <p className="text-zinc-400 mt-1 text-sm md:text-base">Gerencie cartões e pague suas faturas</p>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-2 bg-zinc-900/80 border border-zinc-800 p-2 rounded-xl">
          <button onClick={goPrevMonth} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-[140px] text-center font-bold capitalize text-zinc-100 text-sm md:text-base">
            {monthName}
          </span>
          <button onClick={goNextMonth} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Mini-Dashboard Faturas */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
         <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl min-w-[240px] flex-shrink-0 snap-start">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-sm flex items-center gap-2"><Wallet size={16}/> Débito / Pix</span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">{formatCurrency(debitTotal)}</h2>
         </div>

         {invoices.map(c => (
           <div key={c.id} className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl min-w-[260px] flex-shrink-0 snap-start relative overflow-hidden">
             <div className="flex justify-between items-center mb-1 relative z-10">
               <span className="text-zinc-300 font-medium text-sm flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full" style={{backgroundColor: c.color}}></div>
                 Fatura {c.name}
               </span>
               <span className="text-[10px] text-zinc-500 font-medium">Vence dia {c.due_day}</span>
             </div>
             <h2 className="text-2xl font-bold text-zinc-100 mb-3 relative z-10">{formatCurrency(c.invoiceTotal)}</h2>
             
             {/* Progress Limit Bar */}
             <div className="relative z-10">
               <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                 <span>Limite Comprometido</span>
                 <span>{formatCurrency(c.credit_limit || 0)}</span>
               </div>
               <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                 <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, backgroundColor: c.color }}></div>
               </div>
             </div>
             
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-white z-0 pointer-events-none">
                <CreditCard size={80} />
             </div>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Formulário Desktop Sidebar */}
        <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 relative lg:sticky lg:top-6 z-10 h-fit">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-lg md:text-xl font-semibold text-zinc-100 flex items-center gap-2">
               <Plus className="text-rose-400" /> {editingId ? 'Editar Despesa' : 'Novo Gasto'}
             </h2>
             {editingId && (
               <button type="button" onClick={handleCancelEdit} className="text-xs text-zinc-500 hover:text-zinc-300">Cancelar</button>
             )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Descrição</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Mercado" required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm md:text-base" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Valor</label>
                <div className="relative flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-rose-500/50">
                  <span className="pl-3 text-zinc-500 text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full bg-transparent px-2 py-2.5 text-zinc-100 focus:outline-none text-sm md:text-base" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Data</label>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-[9px] text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm text-center" />
              </div>
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between items-center">
                 <label className="text-sm font-medium text-zinc-300">Forma de Pag. / Cartão</label>
                 <button type="button" onClick={() => setShowCardModal(true)} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Settings2 size={12}/> Gerenciar</button>
               </div>
               <select value={cardId} onChange={e => setCardId(e.target.value)} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm appearance-none">
                 <option value="debit">Débito / Dinheiro / Pix</option>
                 {cards.map(c => <option key={c.id} value={c.id}>💳 {c.name}</option>)}
               </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-zinc-300">Categoria</label>
                 <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm appearance-none">
                   <option value="">Selecione...</option>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
               <div className="space-y-1.5">
                 <label className="text-sm font-medium text-zinc-300">Nº Parcelas</label>
                 <input type="number" min="1" max="60" disabled={editingId || isRecurring} value={installments} onChange={e => setInstallments(e.target.value)} className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm disabled:opacity-50" />
               </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-zinc-950/30 border border-zinc-800/80 rounded-xl">
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} disabled={editingId} className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-zinc-950 disabled:opacity-50" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-200">Despesa Fixa (Assinatura)</span>
                  <span className="text-[10px] text-zinc-500">Repete o valor todo mês indefinidamente.</span>
                </div>
              </label>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-rose-500 hover:bg-rose-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 text-sm md:text-base">
               {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                 <>{editingId ? <Edit2 size={18} /> : <Plus size={20} />}{editingId ? 'Salvar Alterações' : 'Adicionar Despesa'}</>
               )}
            </button>
          </form>
        </div>

        {/* Histórico/Lista */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
           
           {/* Filtros de Tab */}
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
             <button onClick={() => setActiveTab('all')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap snap-start transition-all border border-zinc-800", activeTab === 'all' ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800")}>Todas</button>
             <button onClick={() => setActiveTab('debit')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap snap-start transition-all border border-zinc-800", activeTab === 'debit' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800")}>Débito/Dinheiro</button>
             {cards.map(c => (
               <button key={c.id} onClick={() => setActiveTab(c.id)} style={{ borderColor: activeTab === c.id ? c.color : '#27272a', color: activeTab === c.id ? c.color : '#a1a1aa' }} className={cn("px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap snap-start border bg-zinc-900/80 hover:bg-zinc-800 transition-all")}>{c.name}</button>
             ))}
           </div>

          {loading ? (
             <div className="text-zinc-400 flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando...</div>
          ) : filteredList.length === 0 ? (
             <div className="bg-zinc-900/30 border border-zinc-800/50 border-dashed rounded-2xl p-8 md:p-12 text-center text-zinc-500 flex flex-col items-center">
                <p>Nenhuma despesa correspondente encontrada neste mês.</p>
             </div>
          ) : (
             <div className="space-y-3 md:space-y-4">
               {filteredList.map(exp => {
                 const card = exp.cards;
                 const isPaid = exp.status === 'paid';
                 
                 return (
                   <div key={exp.id} className={cn(
                     "bg-zinc-900/40 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-zinc-900",
                     isPaid ? "border-emerald-500/30 opacity-75" : "border-zinc-800/80",
                     editingId === exp.id && "border-rose-500/50 ring-1 ring-rose-500/50"
                   )}>
                     
                     <div className="flex items-center gap-4 flex-1">
                       <button onClick={() => toggleStatus(exp)} className="p-1 -m-1 transition-colors flex-shrink-0" title={isPaid ? "Ativar como Pendente" : "Marcar como Pago"}>
                         {isPaid ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Circle className="text-zinc-600 hover:text-emerald-400" size={24} />}
                       </button>
                       
                       <div className="min-w-0">
                         <div className="flex items-center gap-2 mb-1 flex-wrap">
                           {card ? (
                             <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white border border-opacity-30 flex items-center gap-1" style={{ backgroundColor: `${card.color}20`, color: card.color, borderColor: card.color }}>
                               💳 {card.name}
                             </span>
                           ) : (
                             <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Débito</span>
                           )}
                           {exp.is_recurring && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold text-center">Fixa</span>}
                         </div>
                         <p className={cn("font-medium text-sm md:text-base text-zinc-100 truncate", isPaid && "line-through text-zinc-400")}>{exp.description}</p>
                         <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                            {new Date(exp.expense_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                            {exp.categories && <><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: exp.categories.color}}></span> {exp.categories.name}</>}
                         </p>
                       </div>
                     </div>

                     <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-zinc-800/50 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                       <div className="text-left sm:text-right flex flex-col items-start sm:items-end flex-shrink-0">
                         <span className={cn("text-lg md:text-xl font-bold transition-colors", isPaid ? "text-emerald-500" : "text-rose-400")}>{formatCurrency(exp.amount)}</span>
                       </div>
                       <div className="flex items-center gap-1 flex-shrink-0">
                         <button onClick={() => handleEdit(exp)} className="text-zinc-500 hover:text-zinc-300 p-2 rounded-lg transition-colors" title="Editar"><Edit2 size={16} /></button>
                         <button onClick={() => handleDelete(exp.id)} className="text-zinc-500 hover:text-red-400 p-2 rounded-lg transition-colors" title="Excluir"><Trash2 size={16} /></button>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
      
      {/* Modal de Gestão de Cartões */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Meus Cartões</h3>
                <button onClick={() => setShowCardModal(false)} className="text-zinc-500 hover:text-zinc-200"><X size={20}/></button>
             </div>
             
             <div className="space-y-4 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
               {cards.length === 0 ? <p className="text-xs text-center text-zinc-500">Nenhum cartão cadastrado ainda.</p> : 
                 cards.map(c => (
                   <div key={c.id} className="flex justify-between items-center p-3 border border-zinc-800 rounded-xl bg-zinc-950/50">
                     <div className="flex items-center gap-3">
                       <span className="w-4 h-4 rounded-full" style={{backgroundColor: c.color}}></span>
                       <div>
                         <p className="text-sm font-semibold text-zinc-200">{c.name}</p>
                         <p className="text-[10px] text-zinc-500">Lim: {formatCurrency(c.credit_limit)} | Fecha: {c.closing_day}</p>
                       </div>
                     </div>
                     <button onClick={async () => { if(window.confirm('Excluir este cartão? Moverá despesas dele para Débito.')) { await supabase.from('cards').delete().eq('id', c.id); fetchCoreData(); } }} className="text-red-400/50 hover:text-red-400"><Trash2 size={16}/></button>
                   </div>
                 ))
               }
             </div>
             
             <form onSubmit={handleCardSubmit} className="space-y-4 border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-semibold text-zinc-300">Novo Cartão</h4>
                <div className="grid grid-cols-2 gap-3">
                   <input type="text" placeholder="Nome do Cartão" value={cardForm.name} onChange={e=>setCardForm({...cardForm, name: e.target.value})} required className="col-span-2 bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
                   
                   <div className="flex items-center gap-2 col-span-2">
                     <span className="text-xs text-zinc-400 whitespace-nowrap">Cor visual: </span>
                     <input type="color" value={cardForm.color} onChange={e=>setCardForm({...cardForm, color: e.target.value})} className="w-10 h-8 rounded border-none bg-transparent cursor-pointer" />
                   </div>
                   
                   <div className="space-y-1">
                     <label className="text-[10px] text-zinc-500">Dia Vencimento</label>
                     <input type="number" min="1" max="31" value={cardForm.due_day} onChange={e=>setCardForm({...cardForm, due_day: e.target.value})} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-100" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] text-zinc-500">Dia Fechamento</label>
                     <input type="number" min="1" max="31" value={cardForm.closing_day} onChange={e=>setCardForm({...cardForm, closing_day: e.target.value})} required className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-100" />
                   </div>
                   <div className="col-span-2 space-y-1">
                     <label className="text-[10px] text-zinc-500">Limite Total (Opcional)</label>
                     <div className="relative flex items-center bg-zinc-950/50 border border-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-emerald-500/50">
                       <span className="pl-3 text-zinc-500 text-xs">R$</span>
                       <input type="number" step="0.01" min="0" placeholder="0.00" value={cardForm.credit_limit} onChange={e=>setCardForm({...cardForm, credit_limit: e.target.value})} className="w-full bg-transparent px-2 py-2 text-sm text-zinc-100 focus:outline-none" />
                     </div>
                   </div>
                </div>
                <button type="submit" disabled={isSubmittingCard} className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold rounded-lg text-sm mt-2 transition-colors">
                  {isSubmittingCard ? 'Salvando...' : 'Cadastrar Cartão'}
                </button>
             </form>
          </div>
        </div>
      )}
      {/* Scrollbar CSS Patch */}
      <style>{`.scrollbar-none::-webkit-scrollbar{display:none;} .custom-scrollbar::-webkit-scrollbar{width:4px;} .custom-scrollbar::-webkit-scrollbar-track{background:transparent;} .custom-scrollbar::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:4px;}`}</style>
    </div>
  );
}
