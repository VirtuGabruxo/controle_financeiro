import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Plus, Loader2, Trash2, X, Edit2, CheckCircle2, Receipt } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getCutOffDate } from '../lib/utils';
import UserAvatar from '../components/common/UserAvatar';

export default function Cards() {
  const { user, showBalances, activeGroupId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [cardForm, setCardForm] = useState({ name: '', color: '#6366f1', closing_day: 15, due_day: 20, credit_limit: '', user_id: '' });
  const [workspaceMembers, setWorkspaceMembers] = useState([]);

  useEffect(() => {
    if (activeGroupId) {
      fetchCardsData();
    }
  }, [user, activeGroupId]);

  const fetchCardsData = async () => {
    setLoading(true);
    try {
      const { data: membersData } = await supabase.from('membros_grupo')
        .select('user_id, profiles(full_name, email)')
        .eq('grupo_id', activeGroupId);
      if (membersData) setWorkspaceMembers(membersData);

      const { data: cardsData, error: errC } = await supabase.from('cards').select('*').eq('grupo_id', activeGroupId).order('name');
      if (errC) {
        console.error("Supabase Error (Cards):", errC);
        throw errC;
      }

      const { data: pendingExp, error: errE } = await supabase
        .from('expenses')
        .select('card_id, amount, expense_date')
        .eq('grupo_id', activeGroupId)
        .eq('paga', false)
        .not('card_id', 'is', null);
      if (errE) {
        console.error("Supabase Error (Expenses):", errE);
        throw errE;
      }

      const enhancedCards = cardsData.map(card => {
        const totalPending = pendingExp.filter(e => e.card_id === card.id).reduce((acc, curr) => acc + Number(curr.amount), 0);
        
        // Fatura do Ciclo Atual (Data de Corte Baseada no Fechamento Unificado)
        const cutOffStr = getCutOffDate(card.closing_day);

        const currentInvoice = pendingExp
          .filter(e => e.card_id === card.id && e.expense_date <= cutOffStr)
          .reduce((acc, curr) => acc + Number(curr.amount), 0);

        const limit = Number(card.credit_limit || 0);
        const available = Math.max(limit - totalPending, 0);
        const consumedPct = limit > 0 ? (totalPending / limit) * 100 : 0;
        
        // Map profile manually
        const member = membersData?.find(m => m.user_id === card.user_id);
        const cardProfile = member ? member.profiles : null;
        
        return { ...card, profiles: cardProfile, totalPending, currentInvoice, available, consumedPct };
      });

      setCards(enhancedCards);
    } catch (error) {
      console.error("Erro ao carregar dados dos cartões:", error);
      alert("Erro ao carregar cartões: " + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const handlePagarFatura = async (card) => {
    if (!window.confirm(`Confirmar o pagamento da fatura de ${card.name}?\nIsso marcará todas as compras deste ciclo (e anteriores) como pagas.`)) return;
    
    setIsSubmitting(true);
    try {
      const cutOffStr = getCutOffDate(card.closing_day);
      
      const { error } = await supabase
        .from('expenses')
        .update({ paga: true, status: 'paid' })
        .eq('card_id', card.id)
        .eq('paga', false)
        .lte('expense_date', cutOffStr);

      if (error) throw error;
      
      alert('Fatura paga com sucesso! 🎉');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: [card.color, '#ffffff', '#10b981']
      });
      fetchCardsData();
    } catch (error) {
      alert('Erro ao processar pagamento: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: cardForm.name,
        color: cardForm.color,
        closing_day: parseInt(cardForm.closing_day),
        due_day: parseInt(cardForm.due_day),
        credit_limit: parseFloat(cardForm.credit_limit || 0),
        user_id: cardForm.user_id || user.id
      };

      if (editingCardId) {
        const { error } = await supabase.from('cards').update(payload).eq('id', editingCardId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cards').insert([{ grupo_id: activeGroupId, ...payload }]);
        if (error) throw error;
      }

      closeModal();
      fetchCardsData();
    } catch (error) {
      alert('Erro ao salvar cartão!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (card) => {
    setEditingCardId(card.id);
    setCardForm({
      name: card.name,
      color: card.color,
      closing_day: card.closing_day,
      due_day: card.due_day,
      credit_limit: card.credit_limit,
      user_id: card.user_id || user.id
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCardId(null);
    setCardForm({ name: '', color: '#6366f1', closing_day: 15, due_day: 20, credit_limit: '', user_id: '' });
  };

  const handleDelete = async (id) => {
    if(!window.confirm('Excluir este cartão permanentemente? Todas as despesas dele irão virar "Débito" (sem cartão associado).')) return;
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (!error) fetchCardsData();
  };

  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';
  const sortedCards = [...cards].sort((a, b) => b.consumedPct - a.consumedPct);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12 w-full">
      <div className="flex justify-between items-center sm:items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Meus Cartões</h1>
          <p className="text-muted mt-1 text-sm md:text-base">Gestão de limites e consumo real dos seus cartões</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg text-sm md:text-base">
          <Plus size={18} /> <span className="hidden sm:inline">Cadastrar</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted gap-2"><Loader2 className="animate-spin" /> Carregando cartões...</div>
      ) : sortedCards.length === 0 ? (
        <div className="bg-surface/30 border border-border/50 border-dashed rounded-2xl p-12 text-center text-muted flex flex-col items-center">
            <CreditCard size={48} className="text-zinc-700 mb-4" />
            <p>Nenhum cartão de crédito cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCards.map(c => (
            <div key={c.id} className="bg-surface/60 border border-border rounded-2xl p-6 relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6 relative z-10">
                 <div className="flex flex-col gap-1.5">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full shadow-lg" style={{backgroundColor: c.color}}></div>
                     <h3 className="text-xl font-bold text-content">{c.name}</h3>
                     {c.profiles && <UserAvatar nameOrEmail={c.profiles.full_name || c.profiles.email} size="sm" />}
                   </div>
                   {c.profiles && (
                     <span className="text-[10px] text-muted bg-background/50 inline-block px-1.5 py-0.5 rounded border border-border/50 self-start">
                       Titular: {c.profiles.full_name?.split(' ')[0] || c.profiles.email?.split('@')[0] || 'Membro'}
                     </span>
                   )}
                   <p className="text-xs text-muted mb-1">Fecha dia {c.closing_day} • Vence dia {c.due_day}</p>
                 </div>
                 <div className="flex items-center gap-1 bg-background/50 rounded-lg p-1 border border-border/50">
                   <button onClick={() => handleEdit(c)} className="text-muted hover:text-indigo-400 transition-colors p-1.5 rounded-md hover:bg-border"><Edit2 size={16}/></button>
                   <button onClick={() => handleDelete(c.id)} className="text-muted hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-border"><Trash2 size={16}/></button>
                 </div>
               </div>

               <div className="space-y-4 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted uppercase font-bold tracking-wider">Limite Comprometido (Total)</span>
                    <h2 className="text-3xl font-bold text-content mt-1">{formatCurrency(c.totalPending)}</h2>
                  </div>

                  <div className="bg-background/40 p-3 rounded-xl border border-border/50 flex justify-between items-center text-indigo-400">
                    <span className="text-xs font-medium text-muted text-content">Fatura Fechada (Mês)</span>
                    <span className="text-sm font-bold">{formatCurrency(c.currentInvoice)}</span>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className={c.consumedPct > 80 ? "text-red-400" : "text-muted"}>Consumo do Limite Global</span>
                      <span className="text-content">{c.consumedPct > 100 ? '>100' : c.consumedPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(c.consumedPct, 100)}%`, backgroundColor: c.consumedPct > 80 ? '#f87171' : c.color }}></div>
                    </div>
                    <div className="flex justify-between text-[11px] mt-1.5 font-medium">
                      <span className="text-indigo-400">Disponível: {formatCurrency(c.available)}</span>
                      <span className="text-muted">Total: {formatCurrency(c.credit_limit)}</span>
                    </div>
                  </div>

                  {c.currentInvoice > 0 && (
                    <button 
                      onClick={() => handlePagarFatura(c)}
                      disabled={isSubmitting}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition-all shadow-sm group/btn"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} className="group-hover/btn:scale-110 transition-transform" />}
                      PAGAR FATURA ATUAL
                    </button>
                  )}
               </div>
               
               <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-white z-0 pointer-events-none transform translate-x-4 -translate-y-4">
                  <CreditCard size={120} />
               </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-content">{editingCardId ? 'Editar Cartão' : 'Registrar Cartão'}</h3>
                <button onClick={closeModal} className="text-muted hover:text-content"><X size={20}/></button>
             </div>
             
             <form onSubmit={handleCardSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2 space-y-1">
                     <label className="text-xs text-muted">Titular do Cartão</label>
                     <select value={cardForm.user_id || user?.id || ''} onChange={e=>setCardForm({...cardForm, user_id: e.target.value})} className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-sm text-content focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none">
                       {workspaceMembers.map(m => (
                         <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.profiles?.email}</option>
                       ))}
                     </select>
                   </div>
                   <div className="col-span-2 space-y-1">
                     <label className="text-xs text-muted">Nome do Cartão (Instituição)</label>
                     <input type="text" placeholder="Ex: Nubank, Itaú..." value={cardForm.name} onChange={e=>setCardForm({...cardForm, name: e.target.value})} required className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-sm text-content focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                   </div>
                   
                   <div className="flex flex-col gap-1 col-span-2">
                     <label className="text-xs text-muted">Cor Identificadora</label>
                     <div className="flex items-center gap-3 bg-background/50 p-2 border border-border rounded-lg">
                       <input type="color" value={cardForm.color} onChange={e=>setCardForm({...cardForm, color: e.target.value})} className="w-8 h-8 rounded border-none cursor-pointer p-0" />
                       <span className="text-xs text-muted uppercase">{cardForm.color}</span>
                     </div>
                   </div>
                   
                   <div className="space-y-1">
                     <label className="text-xs text-muted">Dia do Vencimento</label>
                     <input type="number" min="1" max="31" value={cardForm.due_day} onChange={e=>setCardForm({...cardForm, due_day: e.target.value})} required className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-sm text-content focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs text-muted">Dia do Fechamento</label>
                     <input type="number" min="1" max="31" value={cardForm.closing_day} onChange={e=>setCardForm({...cardForm, closing_day: e.target.value})} required className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-sm text-content focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                   </div>

                   <div className="col-span-2 space-y-1 pt-2">
                     <label className="text-xs text-muted font-bold text-indigo-400">Limite de Crédito Totalizado</label>
                     <div className="relative flex items-center bg-background/50 border border-border rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                       <span className="pl-4 text-muted text-sm">R$</span>
                       <input type="number" step="0.01" min="0" placeholder="0.00" value={cardForm.credit_limit} onChange={e=>setCardForm({...cardForm, credit_limit: e.target.value})} className="w-full bg-transparent px-3 py-3 text-sm text-content focus:outline-none" />
                     </div>
                   </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl text-sm mt-4 transition-colors shadow-lg shadow-indigo-500/20">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : (editingCardId ? 'Atualizar Cartão' : 'Salvar Cartão')}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
