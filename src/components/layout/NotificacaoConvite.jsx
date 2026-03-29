import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Check, X, Users, Loader2 } from 'lucide-react';

export default function NotificacaoConvite() {
  const { user, refreshGroups } = useAuth();
  const [invites, setInvites] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (user?.email) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    try {
      const { data, error } = await supabase
        .from('convites')
        .select('*, grupos(id, nome)')
        .eq('email_convidado', user.email.toLowerCase())
        .eq('status', 'pendente');

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      console.error("Erro ao carregar convites:", err);
    }
  };

  const handleAction = async (invite, action) => {
    setProcessingId(invite.id);
    try {
      if (action === 'accept') {
        // 1. Atualizar status do convite
        const { error: updateError } = await supabase
          .from('convites')
          .update({ status: 'aceito' })
          .eq('id', invite.id);
        
        if (updateError) throw updateError;

        // 2. Inserir na tabela de membros
        const { error: memberError } = await supabase
          .from('membros_grupo')
          .insert([{
            grupo_id: invite.grupo_id,
            user_id: user.id,
            papel: 'membro'
          }]);

        // Se o erro for de duplicata, ignoramos (usuário já é membro)
        if (memberError && memberError.code !== '23505') throw memberError;

        // 3. Forçar refresh do estado global (AppContext/AuthContext)
        if (refreshGroups) await refreshGroups();
        
        alert(`Sucesso! Você agora faz parte do workspace "${invite.grupos.nome}"`);
      } else {
        // Recusar convite
        const { error: declineError } = await supabase
          .from('convites')
          .update({ status: 'recusado' })
          .eq('id', invite.id);

        if (declineError) throw declineError;
      }
      
      // Remover da lista local para esconder o banner
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (err) {
      console.error("Erro ao processar ação do convite:", err);
      alert("Ocorreu um erro ao processar o convite. Tente novamente.");
    } finally {
      setProcessingId(null);
    }
  };

  if (invites.length === 0) return null;

  // Renderizamos apenas o primeiro convite pendente por vez para não poluir o topo
  const currentInvite = invites[0];

  return (
    <div className="fixed top-0 left-0 w-full z-[100] bg-emerald-600 text-white p-3 flex justify-center items-center gap-4 shadow-md animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3">
        <Users size={20} className="hidden sm:block" />
        <p className="text-sm font-medium">
          Você foi convidado para o workspace <span className="font-bold underline">"{currentInvite.grupos.nome}"</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!!processingId}
          onClick={() => handleAction(currentInvite, 'accept')}
          className="bg-white text-emerald-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          {processingId === currentInvite.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          ACEITAR
        </button>
        <button
          disabled={!!processingId}
          onClick={() => handleAction(currentInvite, 'reject')}
          className="bg-emerald-700/50 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
        >
          {processingId === currentInvite.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          RECUSAR
        </button>
      </div>
    </div>
  );
}
