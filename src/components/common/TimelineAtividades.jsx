import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import { Loader2, History } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Componente que exibe a trilha de auditoria (Activity Log) do workspace.
 */
export default function TimelineAtividades() {
  const { activeGroupId } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeGroupId) {
      fetchLogs();
    }
  }, [activeGroupId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('log_atividades')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('grupo_id', activeGroupId)
        .order('criado_em', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffInSeconds = Math.floor((now - then) / 1000);

    if (diffInSeconds < 60) return 'agora';
    if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 604800) return `há ${Math.floor(diffInSeconds / 86400)} d`;
    
    return then.toLocaleDateString('pt-BR');
  };

  const getActionColor = (acao) => {
    switch (acao) {
      case 'CRIOU': return 'text-emerald-400';
      case 'EDITOU': return 'text-amber-400';
      case 'EXCLUIU': return 'text-rose-400';
      default: return 'text-primary-glow';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted animate-pulse">
        <Loader2 className="animate-spin mb-2" size={24} />
        <p className="text-sm">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base md:text-lg font-semibold text-content flex items-center gap-2">
           <History size={20} className="text-primary-glow" /> Atividades do Workspace
        </h3>
        <button 
          onClick={fetchLogs} 
          className="text-[10px] font-bold uppercase tracking-wider text-muted hover:text-content transition-colors px-2 py-1 rounded-md border border-border/50 bg-background/50"
        >
          Atualizar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
        {logs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl bg-background/20">
            <p className="text-xs text-muted">Ainda não há atividades registradas neste workspace.</p>
          </div>
        ) : (
          <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border/50 before:via-border/30 before:to-transparent">
            {logs.map((log) => (
              <div key={log.id} className="relative flex items-start gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                {/* Avatar Icon Wrapper (Timeline Dot equivalent) */}
                <div className="relative z-10 flex-shrink-0">
                  <UserAvatar 
                    nameOrEmail={log.profiles?.full_name || log.profiles?.email} 
                    size="sm" 
                  />
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-surface",
                    log.acao === 'CRIOU' ? "bg-emerald-500" : log.acao === 'EDITOU' ? "bg-amber-500" : "bg-rose-500"
                  )} />
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <p className="text-xs md:text-sm text-content leading-relaxed">
                      <span className="font-bold text-white">
                        {log.profiles?.full_name?.split(' ')[0] || log.profiles?.email?.split('@')[0]}
                      </span>
                      {" "}
                      <span className={cn("font-medium", getActionColor(log.acao))}>
                        {log.acao.toLowerCase()}
                      </span>
                      {" "}
                      {log.descricao}
                    </p>
                    <span className="text-[10px] text-muted whitespace-nowrap opacity-60">
                      {formatRelativeTime(log.criado_em)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
  );
}
