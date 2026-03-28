import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CreditCard, Loader2, Trash2, Edit2, ChevronLeft, ChevronRight, CheckCircle2, Circle, Settings2, X, Wallet, FileText, Repeat, Landmark } from 'lucide-react';
import { cn } from '../lib/utils';
import UserAvatar from '../components/common/UserAvatar';
import { registrarLogAtividade } from '../lib/activityLogger';

export default function Expenses() {
  const { user, showBalances, activeGroupId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [unpaidExpensesGlobal, setUnpaidExpensesGlobal] = useState([]);

  const getLocalDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d;
  };
  const [currentMonth, setCurrentMonth] = useState(getLocalDate());
  const [activeTab, setActiveTab] = useState('all');

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [cardId, setCardId] = useState('debit');
  const [installments, setInstallments] = useState('1');
  const [expenseType, setExpenseType] = useState('common'); // 'common', 'fixed', 'loan'

  // Card Manager Modal State
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardForm, setCardForm] = useState({ name: '', color: '#6366f1', closing_day: 15, due_day: 20, credit_limit: '' });
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  useEffect(() => { fetchCoreData(); }, [user]);
  useEffect(() => { fetchExpenses(); }, [user, currentMonth]);

  const fetchCoreData = async () => {
    if (!activeGroupId) return;
    const { data: catData } = await supabase.from('categories').select('*').or(`grupo_id.eq.${activeGroupId},user_id.is.null`).order('name');
    if (catData) setCategories(catData);
    const { data: cardData } = await supabase.from('cards').select('*').eq('grupo_id', activeGroupId).order('name');
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

      const { data, error } = await supabase.from('expenses')
        .select(`*, categories(name, color), cards(*), profiles(full_name, avatar_url, email)`)
        .eq('grupo_id', activeGroupId)
        .gte('expense_date', startDay)
        .lte('expense_date', endDay)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);

      // ── GLOBAL UNPAID EXPENSES (Absolute Limit) ──
      const { data: globalData } = await supabase.from('expenses')
        .select('*')
        .eq('grupo_id', activeGroupId)
        .not('card_id', 'is', null)
        .eq('status', 'pending');
      setUnpaidExpensesGlobal(globalData || []);
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
      const isRecurring = expenseType === 'fixed';
      const isLoan = expenseType === 'loan';

      const payloadBase = {
        user_id: user.id,
        grupo_id: activeGroupId,
        category_id: categoryId,
        card_id: (cardId === 'debit' || isLoan) ? null : cardId,
        is_recurring: isRecurring,
        expense_type: expenseType,
        status: 'pending' // Default status
      };

      if (editingId) {
        await supabase.from('expenses').update({
          ...payloadBase,
          description,
          amount: parseFloat(amount),
          expense_date: expenseDate,
        }).eq('id', editingId);
        registrarLogAtividade(activeGroupId, 'EDITOU', 'DESPESA', `Alterou a despesa "${description}" para ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount))}`);
      } else {
        const qty = isRecurring ? 24 : parseInt(installments || '1');
        const baseAmount = (isRecurring || isLoan) ? parseFloat(amount) : (parseFloat(amount) / qty);
        // Note: For loans, 'amount' is usually the installment parcel value directly. 
        // If they enter 10 parcels of 500, we make 10 entries of 500.

        const payloads = [];
        let d = new Date(`${expenseDate}T12:00:00`);

        for (let i = 0; i < qty; i++) {
          payloads.push({
            ...payloadBase,
            description: qty > 1 && !isRecurring ? `${description} (${i + 1}/${qty})` : description,
            amount: baseAmount,
            expense_date: d.toISOString().split('T')[0],
          });
          d.setMonth(d.getMonth() + 1);
        }
        await supabase.from('expenses').insert(payloads);
        registrarLogAtividade(activeGroupId, 'CRIOU', 'DESPESA', `Adicionou a despesa "${description}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount))}`);
      }

      handleCancelEdit();
      fetchExpenses();
      setShowExpenseModal(false);
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
      const { error } = await supabase.from('cards').insert([{ user_id: user.id, name: cardForm.name, color: cardForm.color, closing_day: parseInt(cardForm.closing_day), due_day: parseInt(cardForm.due_day), credit_limit: parseFloat(cardForm.credit_limit || 0) }]);
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
    if (!error) setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: newStatus } : e));
  };

  const handleEdit = (exp) => {
    setEditingId(exp.id);
    setDescription(exp.description || '');
    setAmount(exp.amount.toString());
    setExpenseDate(exp.expense_date);
    setCategoryId(exp.category_id || '');
    setCardId(exp.card_id || 'debit');
    setExpenseType(exp.expense_type || (exp.is_recurring ? 'fixed' : 'common'));
    setInstallments('1');
    setShowExpenseModal(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setInstallments('1');
    setExpenseType('common');
    setShowExpenseModal(false);
  };

  const handleDelete = async (id) => {
    const expenseToDelete = expenses.find(e => e.id === id);
    if (!window.confirm('Excluir esta despesa permanentemente?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      if (expenseToDelete) {
        registrarLogAtividade(activeGroupId, 'EXCLUIU', 'DESPESA', `Removeu a despesa "${expenseToDelete.description}"`);
      }
      fetchExpenses();
    }
  };

  const goPrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth);

  const filteredList = expenses.filter(e => activeTab === 'all' || (activeTab === 'debit' && !e.card_id) || e.card_id === activeTab);

  const invoices = cards.map(c => {
    // Cálculo do limite DEVE ser absoluto (global)
    const total = unpaidExpensesGlobal.filter(e => e.card_id === c.id).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const pct = c.credit_limit > 0 ? Math.min((total / c.credit_limit) * 100, 100) : 0;
    return { ...c, invoiceTotal: total, pct };
  });
  const debitTotal = expenses.filter(e => !e.card_id).reduce((acc, curr) => acc + Number(curr.amount), 0);

  const formProps = {
    editingId, description, setDescription, amount, setAmount, expenseDate, setExpenseDate,
    categoryId, setCategoryId, cardId, setCardId, installments, setInstallments,
    expenseType, setExpenseType, cards, categories, isSubmitting, handleSubmit,
    handleCancelEdit, setShowCardModal
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Minhas Despesas</h1>
          <p className="text-muted mt-1 text-sm md:text-base">Gerencie cartões e pague suas faturas</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-none touch-pan-x">
        <div className="bg-surface/60 border border-border p-4 rounded-2xl min-w-[240px] flex-shrink-0 snap-start">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted text-sm flex items-center gap-2"><Wallet size={16} /> Débito / Pix</span>
          </div>
          <h2 className="text-2xl font-bold text-content">{formatCurrency(debitTotal)}</h2>
        </div>
        {invoices.map(c => (
          <div key={c.id} className="bg-surface/60 border border-border p-4 rounded-2xl min-w-[260px] flex-shrink-0 snap-start relative overflow-hidden">
            <div className="flex justify-between items-center mb-1 relative z-10">
              <span className="text-muted font-medium text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></div> Fatura {c.name}
              </span>
              <span className="text-[10px] text-muted font-medium">Vence dia {c.due_day}</span>
            </div>
            <h2 className="text-2xl font-bold text-content mb-3 relative z-10">{formatCurrency(c.invoiceTotal)}</h2>
            <div className="relative z-10">
              <div className="flex justify-between text-[10px] text-muted mb-1">
                <span>Limite Comprometido</span> <span>{formatCurrency(c.credit_limit || 0)}</span>
              </div>
              <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, backgroundColor: c.color }}></div>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-content z-0 pointer-events-none"><CreditCard size={80} /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

        {/* Formulário Desktop Sidebar (Visible only on LG+) */}
        <div className="hidden lg:block lg:col-span-1">
          <ExpenseForm {...formProps} />
        </div>

        {/* Histórico/Lista */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x w-full md:w-auto touch-pan-x">
              <button onClick={() => setActiveTab('all')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap snap-start transition-all border border-border", activeTab === 'all' ? "bg-surface text-content border-border/80" : "bg-transparent text-muted hover:bg-border")}>Todas</button>
              <button onClick={() => setActiveTab('debit')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap snap-start transition-all border border-border", activeTab === 'debit' ? "bg-primary/20 text-primary-glow border-primary/50" : "bg-transparent text-muted hover:bg-border")}>Débito/Dinheiro</button>
              {cards.map(c => (
                <button key={c.id} onClick={() => setActiveTab(c.id)} style={{ borderColor: activeTab === c.id ? c.color : 'var(--border)', color: activeTab === c.id ? c.color : 'var(--muted)' }} className={cn("px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap snap-start border bg-transparent hover:bg-border transition-all")}>{c.name}</button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 bg-surface/80 border border-border p-1.5 rounded-xl w-full md:w-auto">
              <button onClick={goPrevMonth} className="p-1.5 hover:bg-border rounded-lg text-muted transition-colors"><ChevronLeft size={18} /></button>
              <span className="min-w-[130px] text-center font-bold capitalize text-content text-xs md:text-sm">{monthName}</span>
              <button onClick={goNextMonth} className="p-1.5 hover:bg-border rounded-lg text-muted transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>

          {loading ? (
            <div className="text-muted flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando...</div>
          ) : filteredList.length === 0 ? (
            <div className="bg-surface/30 border border-border/50 border-dashed rounded-2xl p-8 md:p-12 text-center text-muted flex flex-col items-center">
              <p>Nenhum lançamento encontrado neste mês.</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {filteredList.map(exp => {
                const card = exp.cards;
                const isPaid = exp.status === 'paid';

                return (
                  <div key={exp.id} className={cn(
                    "bg-surface/40 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surface",
                    isPaid ? "border-primary/30 opacity-75" : "border-border/80",
                    editingId === exp.id && "border-rose-500/50 ring-1 ring-rose-500/50",
                    exp.expense_type === 'loan' && !isPaid && "border-purple-500/30 bg-purple-500/5"
                  )}>

                    <div className="flex items-center gap-4 flex-1">
                      <button onClick={() => toggleStatus(exp)} className="p-1 -m-1 transition-colors flex-shrink-0">
                        {isPaid ? <CheckCircle2 className="text-primary" size={24} /> : <Circle className="text-zinc-500 hover:text-primary-glow" size={24} />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {card ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border" style={{ backgroundColor: `${card.color}20`, color: card.color, borderColor: `${card.color}40` }}>
                              💳 {card.name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-500/10 text-zinc-500 border border-zinc-500/30">Débito/Dinheiro</span>
                          )}
                          {exp.expense_type === 'fixed' || exp.is_recurring ? <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/30 px-1.5 py-0.5 rounded uppercase font-bold">Assinatura</span> : null}
                          {exp.expense_type === 'loan' && <span className="text-[10px] bg-purple-500/10 text-purple-500 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1"><Landmark size={10} /> Empréstimo</span>}
                        </div>
                        <p className={cn("font-medium text-sm md:text-base text-content truncate", isPaid && "line-through text-muted")}>{exp.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <UserAvatar nameOrEmail={exp.profiles?.full_name || exp.profiles?.email} size="sm" />
                          <p className="text-[10px] md:text-xs text-muted flex items-center gap-2">
                            {new Date(exp.expense_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            {exp.categories && <><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: exp.categories.color }}></span> {exp.categories.name}</>}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-border/50 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                      <div className="text-left sm:text-right flex flex-col items-start sm:items-end flex-shrink-0">
                        <span className={cn("text-lg md:text-xl font-bold transition-colors", isPaid ? "text-primary" : (exp.expense_type === 'loan' ? "text-purple-500" : "text-rose-400"))}>{formatCurrency(exp.amount)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => handleEdit(exp)} className="text-muted hover:text-content p-2 rounded-lg transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(exp.id)} className="text-muted hover:text-red-400 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE FAB ── */}
      <button
        onClick={() => { handleCancelEdit(); setShowExpenseModal(true); }}
        className="fixed bottom-20 right-6 z-40 lg:hidden w-14 h-14 bg-rose-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-rose-400 transition-all active:scale-95 border-2 border-white/20"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* ── MOBILE MODAL ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancelEdit} />
          <div className="relative w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom duration-300">
            <div className="px-4 py-6">
              <ExpenseForm {...formProps} embedded={false} />
            </div>
          </div>
        </div>
      )}

      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary-glow to-cyan-400 bg-clip-text text-transparent">Meus Cartões</h3>
              <button onClick={() => setShowCardModal(false)} className="text-muted hover:text-content"><X size={20} /></button>
            </div>

            <div className="space-y-4 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {cards.length === 0 ? <p className="text-xs text-center text-muted">Nenhum cartão cadastrado ainda.</p> :
                cards.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 border border-border rounded-xl bg-background/50">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }}></span>
                      <div>
                        <p className="text-sm font-semibold text-content">{c.name}</p>
                        <p className="text-[10px] text-muted">Lim: {formatCurrency(c.credit_limit)} | Fecha: {c.closing_day}</p>
                      </div>
                    </div>
                    <button onClick={async () => { if (window.confirm('Excluir este cartão? Moverá despesas dele para Débito.')) { await supabase.from('cards').delete().eq('id', c.id); fetchCoreData(); } }} className="text-red-400/50 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                ))
              }
            </div>

            <form onSubmit={handleCardSubmit} className="space-y-4 border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-muted">Novo Cartão</h4>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Nome do Cartão" value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value })} required className="col-span-2 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm text-content" />
                <div className="flex items-center gap-2 col-span-2">
                  <input type="color" value={cardForm.color} onChange={e => setCardForm({ ...cardForm, color: e.target.value })} className="w-10 h-8 rounded border-none bg-transparent cursor-pointer" />
                </div>
                <div className="space-y-1">
                  <input type="number" min="1" max="31" placeholder='Venc.' value={cardForm.due_day} onChange={e => setCardForm({ ...cardForm, due_day: e.target.value })} required className="w-full bg-background/50 border border-border rounded-lg px-2 py-2 text-sm text-content" />
                </div>
                <div className="space-y-1">
                  <input type="number" min="1" max="31" placeholder='Fecha' value={cardForm.closing_day} onChange={e => setCardForm({ ...cardForm, closing_day: e.target.value })} required className="w-full bg-background/50 border border-border rounded-lg px-2 py-2 text-sm text-content" />
                </div>
                <div className="col-span-2 space-y-1">
                  <div className="relative flex items-center bg-background/50 border border-border rounded-lg focus-within:ring-1 focus-within:ring-primary/50">
                    <span className="pl-3 text-muted text-xs">R$</span>
                    <input type="number" step="0.01" min="0" placeholder="Limite Opcional" value={cardForm.credit_limit} onChange={e => setCardForm({ ...cardForm, credit_limit: e.target.value })} className="w-full bg-transparent px-2 py-2 text-sm text-content focus:outline-none" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={isSubmittingCard} className="w-full py-2 bg-primary hover:bg-primary-glow text-inverse font-bold rounded-lg text-sm mt-2 transition-colors">
                {isSubmittingCard ? 'Salvando...' : 'Cadastrar Cartão'}
              </button>
            </form>
          </div>
        </div>
      )}
      <style>{`.scrollbar-none::-webkit-scrollbar{display:none;} .custom-scrollbar::-webkit-scrollbar{width:4px;} .custom-scrollbar::-webkit-scrollbar-track{background:transparent;} .custom-scrollbar::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}`}</style>
    </div>
  );
}

// ── SUB-COMPONENT (Outside to prevent re-renders / focus loss) ──
const ExpenseForm = ({
  embedded = true,
  editingId, description, setDescription, amount, setAmount, expenseDate, setExpenseDate,
  categoryId, setCategoryId, cardId, setCardId, installments, setInstallments,
  expenseType, setExpenseType, cards, categories, isSubmitting, handleSubmit,
  handleCancelEdit, setShowCardModal
}) => (
  <div className={cn(
    "bg-surface border border-border rounded-2xl p-5 md:p-6 h-fit",
    embedded ? "relative lg:sticky lg:top-6" : ""
  )}>
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-lg md:text-xl font-semibold text-content flex items-center gap-2">
        <Plus className="text-rose-400" /> {editingId ? 'Editar Despesa' : 'Novo Gasto'}
      </h2>
      <button type="button" onClick={handleCancelEdit} className="text-xs text-muted hover:text-content">
        {embedded && !editingId ? null : (embedded ? 'Cancelar' : <X size={20} />)}
      </button>
    </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 mb-4">
        <label className="text-xs font-semibold text-muted tracking-wide uppercase">TIPO DE LANÇAMENTO</label>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={editingId} onClick={() => setExpenseType('common')} className={cn("py-2 px-2 text-[11px] md:text-xs font-semibold rounded-lg flex flex-col items-center justify-center text-center transition-all border", expenseType === 'common' ? "bg-rose-500/10 border-rose-500/50 text-rose-500" : "bg-background/80 border-border text-muted hover:text-content disabled:opacity-50")}>
            <FileText size={16} className="mb-1" /> Compra Comum
          </button>
          <button type="button" disabled={editingId} onClick={() => setExpenseType('fixed')} className={cn("py-2 px-2 text-[11px] md:text-xs font-semibold rounded-lg flex flex-col items-center justify-center text-center transition-all border", expenseType === 'fixed' ? "bg-blue-500/10 border-blue-500/50 text-blue-500" : "bg-background/80 border-border text-muted hover:text-content disabled:opacity-50")}>
            <Repeat size={16} className="mb-1" /> Assinatura Fixa
          </button>
          <button type="button" disabled={editingId} onClick={() => setExpenseType('loan')} className={cn("py-2 px-2 text-[11px] md:text-xs font-semibold rounded-lg flex flex-col items-center justify-center text-center transition-all border", expenseType === 'loan' ? "bg-purple-500/10 border-purple-500/50 text-purple-500" : "bg-background/80 border-border text-muted hover:text-content disabled:opacity-50")}>
            <Landmark size={16} className="mb-1" /> Empréstimo
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted">Descrição</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={expenseType === 'loan' ? "Ex: Financiamento Carro" : "Ex: Mercado"} required className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-content focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm md:text-base" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted">Categoria</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-content focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm appearance-none">
            <option value="">Selecione...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted">Nº Parcelas</label>
          <input type="number" min="1" max="120" disabled={editingId || expenseType === 'fixed'} value={installments} onChange={e => setInstallments(e.target.value)} className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-content focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm disabled:opacity-50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted">{expenseType === 'loan' ? 'Valor da Parcela' : 'Valor'}</label>
          <div className="relative flex items-center bg-background/50 border border-border rounded-xl focus-within:ring-2 focus-within:ring-rose-500/50">
            <span className="pl-3 text-muted text-sm">R$</span>
            <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full bg-transparent px-2 py-2.5 text-content focus:outline-none text-sm md:text-base" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted">{expenseType === 'fixed' ? 'Dia do Vencimento' : 'Data'}</label>
          <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required className="w-full bg-background/50 border border-border rounded-xl px-3 py-[9px] text-content focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm [color-scheme:dark]" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-muted flex items-center gap-2">Forma de Pag. {expenseType === 'loan' && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1 rounded">(Forçado à Débito/Pix)</span>}</label>
          {expenseType !== 'loan' && <button type="button" onClick={() => setShowCardModal(true)} className="text-[10px] text-primary-glow hover:text-content flex items-center gap-1"><Settings2 size={12} /> Gerenciar</button>}
        </div>
        <select disabled={expenseType === 'loan'} value={expenseType === 'loan' ? 'debit' : cardId} onChange={e => setCardId(e.target.value)} required className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-content focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm appearance-none disabled:opacity-60">
          <option value="debit">Débito / Dinheiro / Pix</option>
          {cards.map(c => <option key={c.id} value={c.id}>💳 {c.name}</option>)}
        </select>
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full bg-rose-500 hover:bg-rose-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 text-sm md:text-base">
        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (<>{editingId ? <Edit2 size={18} /> : <Plus size={20} />}{editingId ? 'Salvar Alterações' : 'Adicionar Lançamento'}</>)}
      </button>
    </form>
  </div>
);

// UserAvatarBadge removido em favor do componente centralizado UserAvatar
