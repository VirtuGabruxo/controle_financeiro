import { supabase } from './supabase';

/**
 * Registra um log de atividade no Supabase.
 * @param {string} grupo_id - ID do grupo/workspace.
 * @param {string} acao - Tipo de ação: 'CRIOU', 'EDITOU', 'EXCLUIU'.
 * @param {string} entidade - Entidade afetada: 'DESPESA', 'RENDA', 'WORKSPACE', 'CATEGORIA'.
 * @param {string} descricao - Descrição detalhada da ação.
 */
export const registrarLogAtividade = async (grupo_id, acao, entidade, descricao) => {
  try {
    // Obter o usuário atual da sessão
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Tentativa de log sem usuário autenticado.');
      return;
    }

    if (!grupo_id) {
      console.warn('Tentativa de log sem grupo_id especificado.');
      return;
    }

    const { error } = await supabase.from('log_atividades').insert([
      {
        grupo_id,
        user_id: user.id,
        acao,
        entidade,
        descricao
      }
    ]);

    if (error) {
      console.error('Erro ao registrar log no banco:', error.message);
    }
  } catch (err) {
    console.error('Erro inesperado ao registrar log:', err);
  }
};
