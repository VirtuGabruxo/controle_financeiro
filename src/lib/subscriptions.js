import { supabase } from './supabase';

/**
 * MOTOR DE GERAÇÃO DE ASSINATURAS (Recorrências)
 * Verifica assinaturas ativas e gera a despesa do mês atual caso não exista.
 */
export async function processarAssinaturasAtivas(activeGroupId) {
  if (!activeGroupId) return;

  try {
    // 1. Buscar todas as assinaturas ativas do grupo
    const { data: assinaturas, error: subError } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('grupo_id', activeGroupId)
      .eq('ativa', true);

    if (subError) throw subError;
    if (!assinaturas || assinaturas.length === 0) return;

    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    for (const sub of assinaturas) {
      // 2. Definir a data alvo para a cobrança deste mês
      // Usamos o dia_vencimento da assinatura no mês/ano atual
      const targetDate = new Date(currentYear, currentMonth, sub.dia_vencimento);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // 3. Verificar se já existe uma despesa gerada para esta assinatura neste mês/ano
      // Buscamos pelo assinatura_id para evitar duplicidade
      const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;

      const { data: existing, error: checkError } = await supabase
        .from('expenses')
        .select('id')
        .eq('assinatura_id', sub.id)
        .gte('expense_date', startOfMonth)
        .lte('expense_date', endOfMonth)
        .limit(1);

      if (checkError) {
        console.error(`Erro ao verificar assinatura ${sub.nome}:`, checkError);
        continue;
      }

      // 4. Se não existe, inserimos a nova despesa
      if (!existing || existing.length === 0) {
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            grupo_id: activeGroupId,
            assinatura_id: sub.id,
            description: sub.nome, // Nome da assinatura
            amount: sub.valor,
            expense_date: targetDateStr,
            category_id: sub.categoria_id,
            card_id: sub.cartao_id,
            expense_type: 'subscription', // Tipo para identificação
            paga: false // Sempre inicia como pendente
          });

        if (insertError) {
          console.error(`Erro ao gerar despesa para ${sub.nome}:`, insertError);
        } else {
          console.log(`[ASSINATURAS] Lançamento de "${sub.nome}" gerado para ${targetDateStr}`);
        }
      }
    }
  } catch (error) {
    console.error('Falha no motor de assinaturas:', error);
  }
}
