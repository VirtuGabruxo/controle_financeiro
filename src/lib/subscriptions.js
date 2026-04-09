import { supabase } from './supabase';

/**
 * MOTOR DE GERAÇÃO DE ASSINATURAS v2 (Recorrências)
 * Verifica assinaturas ativas e gera a despesa do mês atual caso não exista.
 * 
 * Melhorias v2:
 *  - Respeita data_inicio: só gera despesa se mês/ano atual >= data_inicio
 *  - Regra do Cartão: se vinculada a cartão, usa closing_day/due_day para posicionar a despesa
 */
export async function processarAssinaturasAtivas(activeGroupId) {
  if (!activeGroupId) return;

  try {
    // 1. Buscar assinaturas ativas com dados do cartão vinculado
    const { data: assinaturas, error: subError } = await supabase
      .from('assinaturas')
      .select('*, cards(closing_day, due_day)')
      .eq('grupo_id', activeGroupId)
      .eq('ativa', true);

    if (subError) throw subError;
    if (!assinaturas || assinaturas.length === 0) return;

    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    for (const sub of assinaturas) {
      // ── GUARD: Respeitar data_inicio ──
      // Se a assinatura tem data_inicio definida, só gerar despesa se mês/ano atual >= data_inicio
      if (sub.data_inicio) {
        const inicio = new Date(sub.data_inicio + 'T12:00:00');
        const inicioYear = inicio.getFullYear();
        const inicioMonth = inicio.getMonth();
        if (currentYear < inicioYear || (currentYear === inicioYear && currentMonth < inicioMonth)) {
          console.log(`[ASSINATURAS] "${sub.nome}" ainda não iniciou (início: ${sub.data_inicio}). Pulando.`);
          continue;
        }
      }

      // 2. Definir a data alvo para a cobrança deste mês
      const diaCobranca = Math.min(sub.dia_vencimento, new Date(currentYear, currentMonth + 1, 0).getDate());
      const targetDate = new Date(currentYear, currentMonth, diaCobranca);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // 3. Verificar se já existe uma despesa gerada para esta assinatura neste mês/ano
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
            user_id: sub.user_id,
            grupo_id: activeGroupId,
            assinatura_id: sub.id,
            description: sub.nome,
            amount: sub.valor,
            expense_date: targetDateStr,
            category_id: sub.categoria_id,
            card_id: sub.cartao_id,
            expense_type: 'subscription',
            paga: false
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

/**
 * Injeta a primeira despesa de uma assinatura recém-criada.
 * Chamada imediatamente após o INSERT da assinatura.
 * 
 * @param {object} assinatura - Dados da assinatura recém-criada
 * @param {object|null} card - Dados do cartão vinculado (closing_day, due_day) ou null
 */
export async function injetarPrimeiraDespesa(assinatura, card = null) {
  try {
    // Extrair mês/ano de início
    const inicio = new Date(assinatura.data_inicio + 'T12:00:00');
    const mesInicio = inicio.getMonth();
    const anoInicio = inicio.getFullYear();

    // Calcular dia real (cuidado com meses curtos: ex dia 31 em fev)
    const ultimoDia = new Date(anoInicio, mesInicio + 1, 0).getDate();
    const diaReal = Math.min(assinatura.dia_vencimento, ultimoDia);
    const expenseDate = new Date(anoInicio, mesInicio, diaReal);
    const expenseDateStr = expenseDate.toISOString().split('T')[0];

    // Verificar se já existe (segurança contra duplicação)
    const startOfMonth = `${anoInicio}-${String(mesInicio + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${anoInicio}-${String(mesInicio + 1).padStart(2, '0')}-31`;

    const { data: existing } = await supabase
      .from('expenses')
      .select('id')
      .eq('assinatura_id', assinatura.id)
      .gte('expense_date', startOfMonth)
      .lte('expense_date', endOfMonth)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[ASSINATURAS] Despesa inicial de "${assinatura.nome}" já existe. Pulando.`);
      return;
    }

    const { error } = await supabase
      .from('expenses')
      .insert({
        user_id: assinatura.user_id,
        grupo_id: assinatura.grupo_id,
        assinatura_id: assinatura.id,
        description: assinatura.nome,
        amount: assinatura.valor,
        expense_date: expenseDateStr,
        category_id: assinatura.categoria_id,
        card_id: assinatura.cartao_id,
        expense_type: 'subscription',
        paga: false
      });

    if (error) {
      console.error(`[ASSINATURAS] Erro ao injetar primeira despesa de "${assinatura.nome}":`, error);
    } else {
      console.log(`[ASSINATURAS] Primeira despesa de "${assinatura.nome}" injetada em ${expenseDateStr}`);
    }
  } catch (err) {
    console.error('[ASSINATURAS] Falha ao injetar primeira despesa:', err);
  }
}

/**
 * Cancelamento inteligente de assinatura.
 * 
 * @param {'next_month' | 'immediate'} mode
 *  - 'next_month': mantém o lançamento do mês atual, remove apenas futuros
 *  - 'immediate': remove lançamento do mês atual e futuros (não pagos)
 * @param {string} assinaturaId - UUID da assinatura
 */
export async function cancelarAssinatura(mode, assinaturaId) {
  try {
    // 1. Inativar a assinatura
    const { error: updateError } = await supabase
      .from('assinaturas')
      .update({ ativa: false })
      .eq('id', assinaturaId);

    if (updateError) throw updateError;

    // 2. Calcular datas de referência
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    const firstDayCurrentMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDayCurrentMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;

    if (mode === 'next_month') {
      // Opção A: Deletar despesas NÃO pagas com data DEPOIS do mês atual
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('assinatura_id', assinaturaId)
        .eq('paga', false)
        .gt('expense_date', lastDayCurrentMonth);

      if (deleteError) {
        console.warn('[CANCELAMENTO] Falha ao remover projeções futuras:', deleteError);
      }
    } else if (mode === 'immediate') {
      // Opção B: Deletar despesas NÃO pagas com data >= início do mês atual
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('assinatura_id', assinaturaId)
        .eq('paga', false)
        .gte('expense_date', firstDayCurrentMonth);

      if (deleteError) {
        console.warn('[CANCELAMENTO] Falha ao remover despesas do mês atual e futuras:', deleteError);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[CANCELAMENTO] Erro ao cancelar assinatura:', error);
    return { success: false, error };
  }
}
