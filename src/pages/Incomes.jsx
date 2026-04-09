import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, DollarSign, Loader2, Trash2, Edit2, ChevronLeft, ChevronRight, Users, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { registrarLogAtividade } from '../lib/activityLogger';
import UserAvatar from '../components/common/UserAvatar';

export default function Incomes() {
  const { user, showBalances, activeGroupId } = useAuth();
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  
  // ── Filtros Globais ──
  const getLocalDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d;
  };
  const [currentMonth, setCurrentMonth] = useState(getLocalDate());
  const [filtroMembroId, setFiltroMembroId] = useState(null);

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
    if (activeGroupId) {
      fetchIncomes();
      fetchMembers();
    }
  }, [user, activeGroupId]);

  const fetchMembers = async () => {
    if (!activeGroupId) return;
    const { data: membersData } = await supabase
      .from('membros_grupo')
      .select('user_id, profiles(full_name, avatar_url, email)')
      .eq('grupo_id', activeGroupId);
    
    if (membersData) {
      setGroupMembers(membersData.map(m => ({
        user_id: m.user_id,
        name: m.profiles?.full_name || m.profiles?.email || 'Membro',
        email: m.profiles?.email,
        avatar_url: m.profiles?.avatar_url
      })));
    }
  };

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('incomes')
        .select('*, profiles(full_name, avatar_url, email)')
        .eq('grupo_id', activeGroupId)
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
        grupo_id: activeGroupId,
        month: month,
        description: description,
        type: type,
        gross_amount: parseFloat(grossAmount || 0),
        discounts: parseFloat(discounts || 0),
        overtime_amount: 0
      };

      if (editingId) {
        const { error } = await supabase.from('incomes').update(payload).eq('id', editingId);
        if (error) throw error;
        registrarLogAtividade(activeGroupId, 'EDITOU', 'RENDA', `Alterou a renda "${description}" para ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(grossAmount))}`);
      } else {
        const { error } = await supabase.from('incomes').insert([payload]);
        if (error) throw error;
        registrarLogAtividade(activeGroupId, 'CRIOU', 'RENDA', `Adicionou a renda "${description}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(grossAmount))}`);
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
  };

  const handleDelete = async (id) => {
    const incomeToDelete = incomes.find(inc => inc.id === id);
    if(!window.confirm('Tem certeza em excluir esta renda?')) return;
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (!error) {
      if (incomeToDelete) {
        registrarLogAtividade(activeGroupId, 'EXCLUIU', 'RENDA', `Removeu a renda "${incomeToDelete.description}"`);
      }
      fetchIncomes();
    }
  };

  // ── Navegação de Mês ──
  const goPrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const formatCurrency = (value) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'R$ ****';
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth);

  // ── Filtragem por Mês/Ano e Membro ──
  const filterYear = currentMonth.getFullYear();
  const filterMonth = currentMonth.getMonth(); // 0-indexed

  const filteredIncomes = incomes.filter(inc => {
    // Filtro de mês/ano
    const incDate = new Date(inc.month + 'T12:00:00');
    const incMonth = incDate.getMonth();
    const incYear = incDate.getFullYear();
    const monthMatch = incMonth === filterMonth && incYear === filterYear;

    // Filtro de membro
    const memberMatch = !filtroMembroId || inc.user_id === filtroMembroId;

    return monthMatch && memberMatch;
  });

  // Total líquido do mês filtrado
  const totalLiquidoMes = filteredIncomes.reduce((acc, inc) => {
    const net = inc.net_amount !== undefined ? inc.net_amount : (inc.gross_amount - (inc.discounts || 0));
    return acc + net;
  }, 0);
  
  // Cálculo em Tempo Real do Formulário
  const estimatedNet = parseFloat(grossAmount || 0) - parseFloat(discounts || 0);

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary-glow to-cyan-400 bg-clip-text text-transparent">Minhas Rendas</h1>
        <p className="text-muted mt-1 text-sm md:text-base">Gerencie seus salários e todas as suas fontes de receita extra.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* ── Formulário (Sidebar) ── */}
        <div className="lg:col-span-1 bg-surface lg:bg-surface/80 backdrop-blur-md border border-border rounded-2xl p-5 md:p-6 relative lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden custom-scrollbar z-10 shadow-xl lg:shadow-none">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-lg md:text-xl font-semibold text-content flex items-center gap-2">
               <DollarSign className="text-primary-glow" /> {editingId ? 'Editar Renda' : 'Nova Renda'}
             </h2>
             {editingId && (
               <button type="button" onClick={handleCancelEdit} className="text-xs text-muted hover:text-content">Cancelar</button>
             )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
               <label className="text-sm font-medium text-muted">Tipo de Renda</label>
               <div className="grid grid-cols-3 gap-2">
                 {['Salário', 'Extra', 'Bônus'].map(t => (
                   <button
                     key={t}
                     type="button"
                     onClick={() => setType(t)}
                     className={cn(
                       "py-2 px-3 text-xs md:text-sm font-medium rounded-xl border transition-all text-center",
                       type === t 
                         ? "bg-primary/20 border-primary/50 text-primary-glow" 
                         : "bg-background/50 border-border text-muted hover:bg-border"
                     )}
                   >
                     {t}
                   </button>
                 ))}
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Descrição</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Salário Empresa X" required className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-content focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Mês de Referência</label>
              <input type="date" required value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-content focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm [color-scheme:dark]" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">Valor Bruto</label>
                <div className="relative flex items-center bg-background/50 border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                  <span className="pl-4 text-muted font-medium text-sm">R$</span>
                  <input type="number" min="0" step="0.01" required value={grossAmount} onChange={e => setGrossAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-2.5 text-content focus:outline-none text-sm md:text-base" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">Descontos</label>
                <div className="relative flex items-center bg-background/50 border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                  <span className="pl-4 text-muted font-medium text-sm">R$</span>
                  <input type="number" min="0" step="0.01" value={discounts} onChange={e => setDiscounts(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-2.5 text-content focus:outline-none text-sm md:text-base" />
                </div>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-border">
               <div className="flex flex-col text-sm bg-background/50 p-4 rounded-xl border border-border/50">
                 <span className="text-muted mb-1">Total Líquido Estimado</span>
                 <span className="text-2xl font-bold text-primary-glow">{formatCurrency(estimatedNet)}</span>
               </div>
            </div>

            <div className="lg:sticky lg:bottom-0 bg-surface pt-4 z-10">
              <button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary-glow text-inverse font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm md:text-base">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    {editingId ? <Edit2 size={18} /> : <Plus size={20} />}
                    {editingId ? 'Salvar Alterações' : 'Adicionar Renda'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Lista de Rendas (com Filtros) ── */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          
          {/* ── SELETOR DE PERÍODO ── */}
          <div className="flex items-center justify-between gap-2 bg-surface/80 border border-border p-1.5 rounded-xl w-full">
            <button onClick={goPrevMonth} className="p-1.5 hover:bg-border rounded-lg text-muted transition-colors"><ChevronLeft size={18} /></button>
            <span className="min-w-[130px] text-center font-bold capitalize text-content text-xs md:text-sm">{monthName}</span>
            <button onClick={goNextMonth} className="p-1.5 hover:bg-border rounded-lg text-muted transition-colors"><ChevronRight size={18} /></button>
          </div>

          {/* ── FILTRO POR MEMBRO (Avatar Toggle) ── */}
          {groupMembers.length > 1 && (
            <div className="flex items-center gap-3 py-2 px-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest whitespace-nowrap hidden sm:inline">Membro:</span>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                {/* Botão Todos */}
                <button
                  onClick={() => setFiltroMembroId(null)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border whitespace-nowrap",
                    !filtroMembroId
                      ? "bg-primary/15 text-primary border-primary/40 shadow-sm shadow-primary/10"
                      : "bg-transparent text-muted border-border/50 hover:border-border hover:text-content opacity-60 hover:opacity-100"
                  )}
                >
                  <Users size={14} />
                  Todos
                </button>

                <div className="w-px h-6 bg-border/50 mx-1 flex-shrink-0" />

                {/* Avatares dos membros */}
                {groupMembers.map(member => {
                  const isSelected = filtroMembroId === member.user_id;
                  const hasFilter = filtroMembroId !== null;
                  return (
                    <button
                      key={member.user_id}
                      onClick={() => setFiltroMembroId(isSelected ? null : member.user_id)}
                      title={member.name}
                      className={cn(
                        "relative flex-shrink-0 rounded-full transition-all duration-200 cursor-pointer",
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-[var(--background)] scale-110",
                        hasFilter && !isSelected && "opacity-40 grayscale hover:opacity-70 hover:grayscale-0",
                        !hasFilter && "hover:scale-110 hover:ring-2 hover:ring-border hover:ring-offset-1 hover:ring-offset-[var(--background)]"
                      )}
                    >
                      <UserAvatar nameOrEmail={member.name || member.email} size="md" />
                    </button>
                  );
                })}
              </div>
              {filtroMembroId && (
                <span className="text-[10px] text-primary font-semibold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200 hidden sm:inline">
                  {groupMembers.find(m => m.user_id === filtroMembroId)?.name?.split(' ')[0] || 'Membro'}
                </span>
              )}
            </div>
          )}

          {/* ── TOTAL LÍQUIDO DO MÊS ── */}
          <div className="bg-gradient-to-r from-primary-glow/5 to-cyan-400/5 border border-primary-glow/20 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-glow/10 rounded-xl border border-primary-glow/20">
                <TrendingUp size={22} className="text-primary-glow" />
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Total Líquido do Mês</p>
                <h3 className="text-2xl md:text-3xl font-black text-primary-glow">{formatCurrency(totalLiquidoMes)}</h3>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted uppercase font-medium">{filteredIncomes.length} {filteredIncomes.length === 1 ? 'lançamento' : 'lançamentos'}</p>
            </div>
          </div>

          {/* ── LISTA FLAT (sem agrupamento por mês) ── */}
          {loading ? (
             <div className="text-muted flex items-center gap-2"><Loader2 className="animate-spin" /> Carregando histórico...</div>
          ) : filteredIncomes.length === 0 ? (
             <div className="bg-surface/30 border border-border/50 border-dashed rounded-2xl p-8 md:p-12 text-center text-muted flex flex-col items-center">
                <DollarSign size={48} className="text-zinc-700 mb-4" />
                <p>Nenhuma renda encontrada neste mês.</p>
                <p className="text-sm mt-1">Adicione uma receita no formulário ao lado.</p>
             </div>
          ) : (
             <div className="space-y-3 md:space-y-4">
               {filteredIncomes.map(inc => {
                 const liq = inc.net_amount !== undefined ? inc.net_amount : (inc.gross_amount - (inc.discounts || 0));
                 return (
                   <div key={inc.id} className={cn(
                     "bg-surface/40 border rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-primary/30 hover:bg-surface",
                     editingId === inc.id ? "border-primary/50 ring-1 ring-primary/50" : "border-border/80"
                   )}>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-2 flex-wrap">
                         <span className={cn(
                           "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                           inc.type === 'Salário' ? "bg-blue-500/20 text-blue-400" :
                           inc.type === 'Extra' ? "bg-orange-500/20 text-orange-400" :
                           "bg-purple-500/20 text-purple-400"
                         )}>
                           {inc.type || 'Salário'}
                         </span>
                         <p className="font-semibold text-content text-sm md:text-base truncate">{inc.description || 'Renda sem descrição'}</p>
                       </div>
                       <div className="flex items-center gap-2 mt-1">
                         <UserAvatar nameOrEmail={inc.profiles?.full_name || inc.profiles?.email} size="sm" />
                         <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] md:text-xs text-muted">
                           <span>Bruto: <span className="text-content font-medium">{formatCurrency(inc.gross_amount)}</span></span>
                           {inc.discounts > 0 && <span className="text-red-400/80">Desc: <span className="font-medium">{formatCurrency(inc.discounts)}</span></span>}
                         </div>
                       </div>
                     </div>

                     <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-border/50 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                       <div className="text-left sm:text-right flex flex-col items-start sm:items-end flex-shrink-0">
                         <span className="text-xs text-muted">Líquido</span>
                         <span className="text-lg md:text-xl font-bold text-primary-glow">{formatCurrency(liq)}</span>
                       </div>
                       <div className="flex items-center gap-1 flex-shrink-0">
                         <button onClick={() => handleEdit(inc)} className="text-muted hover:text-primary-glow p-2 rounded-lg transition-colors" title="Editar">
                           <Edit2 size={16} />
                         </button>
                         <button onClick={() => handleDelete(inc.id)} className="text-muted hover:text-red-400 p-2 rounded-lg transition-colors" title="Excluir">
                           <Trash2 size={16} />
                         </button>
                       </div>
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
