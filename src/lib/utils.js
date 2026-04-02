import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * MOTOR DE DATA BANCÁRIO (SENIOR)
 * Identifica o mês de referência da fatura com base no dia de fechamento.
 */
export function identificarMesFatura(expenseDateStr, closingDay) {
  if (!expenseDateStr || !closingDay) return "Indeterminado";
  const d = new Date(expenseDateStr + "T12:00:00");
  if (isNaN(d.getTime())) return "Indeterminado";
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  // Se o dia da compra >= dia de fechamento, vai para a fatura de M+2
  // Caso contrário, vai para a fatura de M+1
  const monthsToAdd = day >= closingDay ? 2 : 1;
  const invoiceDate = new Date(year, month + monthsToAdd, 1);
  
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
  
  const cutOff = new Date(today.getFullYear(), refMonth, closingDay, 23, 59, 59, 999);
  return cutOff.toISOString().split('T')[0];
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
