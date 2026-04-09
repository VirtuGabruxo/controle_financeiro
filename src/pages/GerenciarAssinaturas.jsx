import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { injetarPrimeiraDespesa, cancelarAssinatura } from '../lib/subscriptions';
import { 
  Plus, 
  Calendar, 
  CreditCard, 
  Trash2, 
  X, 
  Edit2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  RefreshCcw,
  Ban,
  Loader2,
  DollarSign,
  CalendarOff,
  XCircle,
  ShieldAlert,
  CalendarCheck
} from 'lucide-react';
import { cn } from '../lib/utils';

const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

// Helper: retorna "YYYY-MM" do mês/ano atual
const getCurrentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function GerenciarAssinaturas() {
  const { user, activeGroupId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assinaturas, setAssinaturas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Cancel Modal State
  const [cancelModalSub, setCancelModalSub] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  
  const [form, setForm] = useState({
    nome: '',
    valor: '',
    categoria_id: '',
    cartao_id: '',
    dia_vencimento: 1,
    data_inicio: getCurrentMonthStr(),
    ativa: true
  });

  useEffect(() => {
    if (activeGroupId) {
      fetchData();
    }
  }, [activeGroupId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, catsRes, cardsRes] = await Promise.all([
        supabase.from('assinaturas').select('*, categories(name), cards(name, closing_day, due_day)').eq('grupo_id', activeGroupId).order('ativa', { ascending: false }).order('nome'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('cards').select('*').eq('grupo_id', activeGroupId).order('name')
      ]);

      if (subsRes.error) throw subsRes.error;
      setAssinaturas(subsRes.data || []);
      setCategories(catsRes.data || []);
      setCards(cardsRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar assinaturas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sub) => {
    setEditingId(sub.id);
    // Derivar mês/ano do data_inicio existente
    let dataInicioStr = getCurrentMonthStr();
    if (sub.data_inicio) {
      const d = new Date(sub.data_inicio + 'T12:00:00');
      dataInicioStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    setForm({
      nome: sub.nome,
      valor: sub.valor,
      categoria_id: sub.categoria_id || '',
      cartao_id: sub.cartao_id || '',
      dia_vencimento: sub.dia_vencimento,
      data_inicio: dataInicioStr,
      ativa: sub.ativa
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Converter "YYYY-MM" para "YYYY-MM-01" como DATE
    const dataInicioDate = form.data_inicio ? `${form.data_inicio}-01` : new Date().toISOString().split('T')[0];
    
    const payload = {
      ...form,
      valor: parseFloat(form.valor.toString().replace(',', '.')),
      grupo_id: activeGroupId,
      categoria_id: form.categoria_id || null,
      cartao_id: form.cartao_id || null,
      data_inicio: dataInicioDate
    };

    try {
      console.log("[ASSINATURAS] Payload enviado:", JSON.stringify(payload, null, 2));

      if (editingId) {
        const { error } = await supabase.from('assinaturas').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        // Criar assinatura
        const { data: newSub, error } = await supabase
          .from('assinaturas')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;

        // Se ativa, injetar primeira despesa imediatamente
        if (newSub && newSub.ativa) {
          const card = form.cartao_id ? cards.find(c => c.id === form.cartao_id) : null;
          await injetarPrimeiraDespesa(newSub, card);
        }
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("[ASSINATURAS] Erro detalhado do Supabase:", error);
      alert("Erro do banco: " + (error?.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CANCELAMENTO INTELIGENTE ──
  const handleOpenCancelModal = (sub) => {
    if (!sub.ativa) {
      // Se está cancelada, reativar direto
      handleReativar(sub);
      return;
    }
    setCancelModalSub(sub);
  };

  const handleReativar = async (sub) => {
    try {
      const { error } = await supabase
        .from('assinaturas')
        .update({ ativa: true })
        .eq('id', sub.id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("[ASSINATURAS] Erro ao reativar:", error);
      alert("Erro ao reativar: " + (error?.message || JSON.stringify(error)));
    }
  };

  const handleCancelConfirm = async (mode) => {
    if (!cancelModalSub) return;
    setCancelLoading(true);

    try {
      const result = await cancelarAssinatura(mode, cancelModalSub.id);
      if (!result.success) {
        throw result.error || new Error('Falha no cancelamento');
      }
      setCancelModalSub(null);
      fetchData();
    } catch (error) {
      console.error("[ASSINATURAS] Erro no cancelamento:", error);
      alert("Erro ao cancelar: " + (error?.message || JSON.stringify(error)));
    } finally {
      setCancelLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ nome: '', valor: '', categoria_id: '', cartao_id: '', dia_vencimento: 1, data_inicio: getCurrentMonthStr(), ativa: true });
    setEditingId(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted animate-pulse">
      <RefreshCcw size={48} className="animate-spin mb-4 opacity-20" />
      <p>Organizando suas recorrências...</p>
    </div>
  );

  const ativas = assinaturas.filter(s => s.ativa);
  const canceladas = assinaturas.filter(s => !s.ativa);

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Assinaturas & Serviços</h1>
          <p className="text-muted mt-1 text-sm md:text-base text-balance text-zinc-400">
            Gerencie pagamentos recorrentes como Netflix, Spotify e Aluguel de forma inteligente.
          </p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-glow text-white font-semibold rounded-xl hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all active:scale-95"
        >
          <Plus size={20} /> Nova Assinatura
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Esquerdo: Ativas */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2 px-1 mb-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <h2 className="font-semibold text-zinc-300">Mensalidades Ativas ({ativas.length})</h2>
          </div>
          
          {ativas.length === 0 ? (
            <div className="bg-surface/40 border border-border border-dashed rounded-2xl p-12 text-center text-muted">
              Nenhuma assinatura ativa encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ativas.map(sub => {
                // Extrair mês/ano de início para exibição
                let inicioLabel = '—';
                if (sub.data_inicio) {
                  const d = new Date(sub.data_inicio + 'T12:00:00');
                  inicioLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d);
                }

                return (
                  <div key={sub.id} className="group bg-surface/60 border border-border rounded-2xl p-5 hover:border-primary-glow/50 transition-all relative overflow-hidden backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-background/50 rounded-xl border border-border text-primary-glow">
                        <RefreshCcw size={22} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(sub)} className="p-2 hover:bg-border rounded-lg text-muted hover:text-content transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => handleOpenCancelModal(sub)} className="p-2 hover:bg-rose-500/10 rounded-lg text-muted hover:text-rose-400 transition-colors" title="Cancelar Assinatura"><Ban size={16}/></button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-lg text-content truncate mb-1">{sub.nome}</h3>
                    <p className="text-2xl font-black text-primary-glow mb-4 tracking-tight">{fmtBRL(sub.valor)}</p>
                    
                    <div className="space-y-2.5 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Calendar size={14} /> Cobrança: <span className="text-zinc-300 font-medium">Todo dia {sub.dia_vencimento}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <CalendarCheck size={14} /> Início: <span className="text-zinc-300 font-medium capitalize">{inicioLabel}</span>
                      </div>
                      {sub.cards ? (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <CreditCard size={14} /> Cartão: <span className="text-zinc-300 font-medium">{sub.cards.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <DollarSign size={14} /> Método: <span className="text-zinc-300 font-medium">Débito Direto / Pix</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lado Direito: Histórico/Canceladas e Meta */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-indigo-500/10 to-primary-glow/10 border border-primary-glow/20 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Clock size={18} /> Impacto Mensal</h3>
            <p className="text-muted text-sm mb-4">Total reservado mensalmente para serviços recorrentes.</p>
            <div className="text-3xl font-black text-content">
              {fmtBRL(ativas.reduce((acc, s) => acc + Number(s.valor), 0))}
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-2 px-1 mb-2">
              <Ban size={18} className="text-zinc-500" />
              <h2 className="font-semibold text-zinc-400">Canceladas ({canceladas.length})</h2>
            </div>
            <div className="space-y-3">
              {canceladas.map(sub => (
                <div key={sub.id} className="bg-surface/30 border border-border rounded-xl p-4 flex items-center justify-between gap-4 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                  <div className="overflow-hidden">
                    <p className="font-bold text-muted truncate text-sm">{sub.nome}</p>
                    <p className="text-xs text-zinc-500">Cancelada em {new Date(sub.criado_em).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted">{fmtBRL(sub.valor)}</span>
                    <button onClick={() => handleOpenCancelModal(sub)} className="p-2 hover:bg-emerald-500/10 rounded-lg text-zinc-500 hover:text-emerald-400 transition-colors" title="Reativar"><RefreshCcw size={14}/></button>
                  </div>
                </div>
              ))}
              {canceladas.length === 0 && <p className="text-xs text-zinc-600 italic px-1">Nenhum histórico de cancelamento.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MODAL: Nova/Editar Assinatura
         ═══════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingId ? 'Editar Assinatura' : 'Nova Assinatura'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-background rounded-lg text-muted"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Nome do Serviço (ex: Netflix)</label>
                <input required type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-glow outline-none transition-all" placeholder="Netflix, Academia..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Valor Mensal</label>
                  <input required type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-glow outline-none transition-all" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Dia de Cobrança</label>
                  <input required type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: parseInt(e.target.value)})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-glow outline-none transition-all" />
                </div>
              </div>

              {/* ── NOVO CAMPO: Mês/Ano de Início ── */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5 flex items-center gap-1.5">
                  <CalendarCheck size={14} className="text-primary-glow" /> Mês/Ano de Início
                </label>
                <input 
                  required 
                  type="month" 
                  value={form.data_inicio} 
                  onChange={e => setForm({...form, data_inicio: e.target.value})} 
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-glow outline-none transition-all [color-scheme:dark]" 
                />
                <p className="text-[10px] text-zinc-500 mt-1.5 px-1 flex items-center gap-1">
                  <AlertCircle size={10}/> A primeira cobrança será gerada automaticamente neste mês.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Categoria</label>
                <select required value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-glow outline-none transition-all appearance-none cursor-pointer">
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Meio de Pagamento (Opcional)</label>
                <select value={form.cartao_id} onChange={e => setForm({...form, cartao_id: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-glow outline-none transition-all appearance-none cursor-pointer">
                  <option value="">Débito Direto / Dinheiro / Pix</option>
                  {cards.map(card => <option key={card.id} value={card.id}>💳 {card.name}</option>)}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1.5 px-1 flex items-center gap-1"><AlertCircle size={10}/> Se vinculado a um cartão, a despesa será aplicada no ciclo de fatura correspondente.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-background border border-border rounded-xl font-medium hover:bg-surface transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-primary-glow text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto"/> : (editingId ? 'Salvar Alterações' : 'Criar Assinatura')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL: Cancelamento Inteligente de Assinatura
         ═══════════════════════════════════════════════════ */}
      {cancelModalSub && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden">
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-border bg-gradient-to-br from-rose-500/5 to-amber-500/5">
              <button
                onClick={() => setCancelModalSub(null)}
                disabled={cancelLoading}
                className="absolute top-4 right-4 p-2 hover:bg-background rounded-lg text-muted hover:text-content transition-colors"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <ShieldAlert size={24} className="text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-content">Cancelar Assinatura</h2>
                  <p className="text-sm text-muted">Como deseja prosseguir?</p>
                </div>
              </div>
              <div className="bg-background/60 rounded-xl px-4 py-3 border border-border/50 flex items-center justify-between">
                <span className="font-semibold text-content text-sm truncate">{cancelModalSub.nome}</span>
                <span className="text-primary-glow font-bold text-sm flex-shrink-0 ml-2">{fmtBRL(cancelModalSub.valor)}/mês</span>
              </div>
            </div>

            {/* Options */}
            <div className="p-6 space-y-3">
              {/* Opção A: A partir do próximo mês */}
              <button
                onClick={() => handleCancelConfirm('next_month')}
                disabled={cancelLoading}
                className="w-full group text-left p-4 rounded-xl border-2 border-border hover:border-amber-500/50 bg-background/50 hover:bg-amber-500/5 transition-all duration-200 disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CalendarOff size={20} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-content text-sm mb-1 flex items-center gap-2">
                      Cancelar a partir do próximo mês
                      {cancelLoading && <Loader2 size={14} className="animate-spin text-amber-400" />}
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      O lançamento <span className="text-amber-400 font-semibold">deste mês permanece</span> na sua tela de despesas. 
                      Apenas futuras cobranças não pagas serão removidas.
                    </p>
                  </div>
                </div>
              </button>

              {/* Opção B: Cancelar imediatamente */}
              <button
                onClick={() => handleCancelConfirm('immediate')}
                disabled={cancelLoading}
                className="w-full group text-left p-4 rounded-xl border-2 border-border hover:border-rose-500/50 bg-background/50 hover:bg-rose-500/5 transition-all duration-200 disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 flex-shrink-0 group-hover:scale-110 transition-transform">
                    <XCircle size={20} className="text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-content text-sm mb-1 flex items-center gap-2">
                      Cancelar imediatamente
                      {cancelLoading && <Loader2 size={14} className="animate-spin text-rose-400" />}
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Remove <span className="text-rose-400 font-semibold">todas as cobranças não pagas</span>, incluindo a deste mês. 
                      Ideal para estornos ou cobranças que não ocorreram.
                    </p>
                  </div>
                </div>
              </button>

              {/* Cancel Action */}
              <button
                onClick={() => setCancelModalSub(null)}
                disabled={cancelLoading}
                className="w-full mt-2 px-4 py-2.5 text-sm text-muted hover:text-content font-medium transition-colors rounded-xl hover:bg-background/50"
              >
                Voltar, não quero cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
