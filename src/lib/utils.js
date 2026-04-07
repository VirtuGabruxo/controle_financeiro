import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * MOTOR DE DATA BANCÁRIO v2 (SENIOR)
 * Identifica o mês de referência da fatura usando algoritmo de 2 passos:
 *   Passo A: Define o mês de fechamento base (compra entrou neste ciclo ou no próximo?)
 *   Passo B: Ajusta para o mês real de vencimento (vencimento no mesmo mês ou no seguinte?)
 *
 * @param {string} expenseDateStr - Data da despesa (YYYY-MM-DD)
 * @param {number} closingDay     - Dia de fechamento do cartão
 * @param {number} [dueDay]       - Dia de vencimento do cartão (opcional, fallback p/ comportamento legado)
 */
export function identificarMesFatura(expenseDateStr, closingDay, dueDay) {
  if (!expenseDateStr || !closingDay) return "Indeterminado";
  const d = new Date(expenseDateStr + "T12:00:00");
  if (isNaN(d.getTime())) return "Indeterminado";

  const day = d.getDate();
  let month = d.getMonth();   // 0-indexed (Jan=0)
  let year = d.getFullYear();

  // ── PASSO A: Mês de Fechamento Base ──
  // Se a compra foi feita no dia do fechamento ou depois, ela "perdeu" o ciclo
  // atual e entra na fatura que fecha no mês seguinte.
  if (day >= closingDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  // Aqui, (year, month) = mês em que ocorre o FECHAMENTO desta fatura.

  // ── PASSO B: Mês de Vencimento (Fatura Real) ──
  // Compara dia_vencimento com dia_fechamento para saber se o vencimento
  // ocorre no mesmo mês do fechamento ou no mês seguinte.
  if (dueDay != null) {
    if (dueDay < closingDay) {
      // Ex: Fecha 26, Vence 02 → o vencimento pula para o mês seguinte
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }
    // Se dueDay >= closingDay (Ex: Fecha 21, Vence 28) → mesmo mês, nada a fazer
  } else {
    // Fallback legado (sem dueDay): assume vencimento no mês seguinte ao fechamento
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  const invoiceDate = new Date(year, month, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(invoiceDate);
}

/**
 * Calcula a data de corte da fatura "fechada" mais recente.
 * Garante que o pagamento não afete despesas posteriores ao fechamento.
 */
export function getCutOffDate(closingDay) {
  if (!closingDay) return null;
  const today = new Date();
  
  // Se hoje ainda não chegamos no fim do dia de fechamento deste mês,
  // a fatura que está "fechada" e pronta para pagamento é a do mês anterior.
  let refMonth = today.getMonth();
  if (today.getDate() < closingDay) {
    refMonth -= 1;
  }
  
  // O ciclo finaliza no *instante antes* do dia de fechamento. 
  // Gastos NO dia de fechamento (ex: dia 21) caem na próxima fatura.
  const cutOff = new Date(today.getFullYear(), refMonth, closingDay - 1);
  const yy = cutOff.getFullYear();
  const mm = String(cutOff.getMonth() + 1).padStart(2, '0');
  const dd = String(cutOff.getDate()).padStart(2, '0');
  
  return `${yy}-${mm}-${dd}`;
}

/**
 * Calcula a data exata do próximo vencimento do cartão
 */
export function calcularProximoVencimento(card, referenceDate = new Date()) {
  if (!card?.closing_day || !card?.due_day) return null;
  
  const today = new Date(referenceDate);
  today.setHours(0,0,0,0);
  
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Vencimento deste mês
  const thisMonthDue = new Date(currentYear, currentMonth, card.due_day);
  
  // Fechamento deste mês
  const thisMonthClosing = new Date(currentYear, currentMonth, card.closing_day);
  
  // Se hoje já passou do fechamento, o próximo vencimento é do próximo ciclo
  if (today >= thisMonthClosing) {
    return new Date(currentYear, currentMonth + 1, card.due_day);
  }
  
  return thisMonthDue;
}

/**
 * Retorna o status da fatura (atual, próxima, anterior) - Legado/Auxiliar
 */
export function getStatusFatura(expenseDateStr, card, referenceDate = new Date()) {
  if (!card || !card.closing_day) return 'debit';
  
  const expDate = new Date(expenseDateStr + "T12:00:00");
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  
  const currentClosingDate = new Date(refYear, refMonth, card.closing_day);
  currentClosingDate.setHours(23, 59, 59, 999);
  
  if (expDate > currentClosingDate) return 'next';
  
  const lastClosingDate = new Date(refYear, refMonth - 1, card.closing_day);
  lastClosingDate.setHours(23, 59, 59, 999);
  
  if (expDate > lastClosingDate) return 'current';
  
  return 'previous';
}
