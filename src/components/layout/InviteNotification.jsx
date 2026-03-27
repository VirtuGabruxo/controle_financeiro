import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Check, X, Users, Loader2 } from 'lucide-react';

export default function InviteNotification() {
  const { user, refreshGroups } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (user?.email) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    const { data } = await supabase
      .from('convites')
      .select('*, grupos(nome)')
      .eq('email_convidado', user.email.toLowerCase())
      .eq('status', 'pendente');
    
    if (data) setInvites(data);
  };

  const handleAction = async (invite, action) => {
    setProcessingId(invite.id);
    try {
      if (action === 'accept') {
        // 1. Atualizar convite
        await supabase
          .from('convites')
          .update({ status: 'aceito' })
          .eq('id', invite.id);

        // 2. Entrar no grupo
        const { error: memberError } = await supabase
          .from('membros_grupo')
          .insert([{
            grupo_id: invite.grupo_id,
            user_id: user.id,
            papel: 'membro'
          }]);

        if (memberError && memberError.code !== '23505') { // Ignore if already a member
          console.error("Erro ao entrar no grupo:", memberError);
        }

        alert(`Você entrou no grupo ${invite.grupos.nome}!`);
        await refreshGroups();
      } else {
        // Recusar
        await supabase
          .from('convites')
          .update({ status: 'recusado' })
          .eq('id', invite.id);
      }
      
      // Limpar da lista local
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (err) {
      console.error("Erro ao processar convite:", err);
    } finally {
      setProcessingId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] w-full max-w-sm animate-in slide-in-from-right-8 duration-500">
      {invites.map(invite => (
        <div key={invite.id} className="bg-surface/90 backdrop-blur-xl border border-primary/30 rounded-2xl p-4 shadow-2xl shadow-primary/20 mb-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users size={20} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-content leading-tight">Convite de Família!</p>
              <p className="text-xs text-muted mt-1">
                Convidaram você para o workspace <span className="text-primary font-bold">"{invite.grupos.nome}"</span>.
              </p>
              
              <div className="flex items-center gap-2 mt-4">
                <button
                  disabled={!!processingId}
                  onClick={() => handleAction(invite, 'accept')}
                  className="flex-1 bg-primary text-white text-[10px] font-bold py-2 rounded-xl hover:bg-primary-glow transition-all flex items-center justify-center gap-1.5"
                >
                  {processingId === invite.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  ACEITAR
                </button>
                <button
                  disabled={!!processingId}
                  onClick={() => handleAction(invite, 'reject')}
                  className="px-3 bg-surface border border-border text-muted text-[10px] font-bold py-2 rounded-xl hover:bg-zinc-800 transition-all flex items-center justify-center"
                >
                  {processingId === invite.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
