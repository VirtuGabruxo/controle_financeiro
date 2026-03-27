import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileDown, FileText, Download, Loader2, Calendar, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';

const PERIOD_OPTIONS = [
  { value: 'this_month', label: 'Este Mês' },
  { value: 'this_quarter', label: 'Trimestre Atual' },
  { value: 'this_semester', label: 'Semestre Atual' },
  { value: 'this_year', label: 'Este Ano' },
  { value: 'custom', label: 'Período Específico' },
];

function getPeriodDates(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === 'this_month') {
    return [
      new Date(y, m, 1).toISOString().split('T')[0],
      new Date(y, m + 1, 0).toISOString().split('T')[0],
    ];
  }
  if (period === 'this_quarter') {
    const q = Math.floor(m / 3);
    return [
      new Date(y, q * 3, 1).toISOString().split('T')[0],
      new Date(y, q * 3 + 3, 0).toISOString().split('T')[0],
    ];
  }
  if (period === 'this_semester') {
    const s = m < 6 ? 0 : 6;
    return [
      new Date(y, s, 1).toISOString().split('T')[0],
      new Date(y, s + 6, 0).toISOString().split('T')[0],
    ];
  }
  if (period === 'this_year') {
    return [`${y}-01-01`, `${y}-12-31`];
  }
  return [null, null];
}

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

export default function ExportarDados() {
  const { user, activeGroupId } = useAuth();
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  /* ─── CSV ─── */
  const handleExportCSV = async () => {
    setCsvLoading(true);
    try {
      const { data: incomes } = await supabase.from('incomes').select('*, categories(name)').eq('grupo_id', activeGroupId);
      const { data: expenses } = await supabase.from('expenses').select('*, categories(name)').eq('grupo_id', activeGroupId);

      let csv = 'Tipo;Data;Descrição;Categoria;Valor\n';
      incomes?.forEach(i => {
        const val = i.net_amount ?? (i.gross_amount - (i.discounts || 0));
        csv += `Receita;${i.month};"${i.description}";${i.categories?.name || 'Geral'};${val.toString().replace('.', ',')}\n`;
      });
      expenses?.forEach(e => {
        csv += `Despesa;${e.expense_date};"${e.description}";${e.categories?.name || 'Geral'};${e.amount.toString().replace('.', ',')}\n`;
      });

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `fincontrol_extrato_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } finally {
      setCsvLoading(false);
    }
  };

  /* ─── PDF ─── */
  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      let [startDate, endDate] = period === 'custom' ? [customStart, customEnd] : getPeriodDates(period);
      if (!startDate || !endDate) {
        alert('Selecione as datas do período personalizado.');
        setPdfLoading(false);
        return;
      }

      const { data: expenses } = await supabase
        .from('expenses')
        .select('description, amount, expense_date, categories(name)')
        .eq('grupo_id', activeGroupId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate + 'T23:59:59')
        .order('expense_date', { ascending: true });

      const { data: incomes } = await supabase
        .from('incomes')
        .select('description, gross_amount, discounts, net_amount, month, categories(name)')
        .eq('grupo_id', activeGroupId)
        .gte('month', startDate)
        .lte('month', endDate + 'T23:59:59')
        .order('month', { ascending: true });

      const totalExp = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
      const totalInc = incomes?.reduce((s, i) => s + Number(i.net_amount ?? (i.gross_amount - (i.discounts || 0))), 0) ?? 0;
      const balance = totalInc - totalExp;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();

      // ── Header ──
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(0, 0, W, 36, 'F');
      doc.setTextColor(16, 185, 129); // emerald
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('FinControl', 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(161, 161, 170);
      doc.setFont('helvetica', 'normal');
      doc.text('Seu controle financeiro pessoal', 14, 23);
      doc.text(`Período: ${fmtDate(startDate)} a ${fmtDate(endDate)}`, 14, 30);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, W - 14, 30, { align: 'right' });

      // ── Summary Cards ──
      let y = 44;
      const cardW = (W - 28 - 8) / 3;
      const cards = [
        { label: 'Total Receitas', value: fmtBRL(totalInc), color: [16, 185, 129] },
        { label: 'Total Despesas', value: fmtBRL(totalExp), color: [251, 113, 133] },
        { label: 'Saldo do Período', value: fmtBRL(balance), color: balance >= 0 ? [99, 102, 241] : [239, 68, 68] },
      ];
      cards.forEach((c, i) => {
        const x = 14 + i * (cardW + 4);
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(x, y, cardW, 20, 3, 3, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...c.color);
        doc.setFont('helvetica', 'bold');
        doc.text(c.label.toUpperCase(), x + 4, y + 7);
        doc.setFontSize(11);
        doc.text(c.value, x + 4, y + 16);
      });

      y += 28;

      // ── Expenses Table ──
      if (expenses && expenses.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(244, 244, 245);
        doc.text('Despesas', 14, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [['Data', 'Descrição', 'Categoria', 'Valor']],
          body: expenses.map(e => [
            fmtDate(e.expense_date),
            e.description,
            e.categories?.name || 'Geral',
            fmtBRL(e.amount),
          ]),
          styles: { fontSize: 8, cellPadding: 3, fillColor: [15, 23, 42], textColor: [244, 244, 245] },
          headStyles: { fillColor: [30, 41, 59], textColor: [251, 113, 133], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [22, 33, 54] },
          columnStyles: { 3: { halign: 'right', textColor: [251, 113, 133] } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── Incomes Table ──
      if (incomes && incomes.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(244, 244, 245);
        doc.text('Receitas', 14, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [['Mês', 'Descrição', 'Categoria', 'Valor Líquido']],
          body: incomes.map(i => [
            fmtDate(i.month),
            i.description,
            i.categories?.name || 'Geral',
            fmtBRL(i.net_amount ?? (i.gross_amount - (i.discounts || 0))),
          ]),
          styles: { fontSize: 8, cellPadding: 3, fillColor: [15, 23, 42], textColor: [244, 244, 245] },
          headStyles: { fillColor: [30, 41, 59], textColor: [16, 185, 129], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [22, 33, 54] },
          columnStyles: { 3: { halign: 'right', textColor: [16, 185, 129] } },
          margin: { left: 14, right: 14 },
        });
      }

      // ── Footer ──
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(113, 113, 122);
        doc.text(`FinControl • Página ${p} de ${pageCount}`, W / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
      }

      doc.save(`fincontrol_relatorio_${startDate}_${endDate}.pdf`);
    } catch (err) {
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Exportar Dados
        </h1>
        <p className="text-muted mt-1">Baixe seus registros financeiros em formato CSV ou PDF formatado.</p>
      </div>

      {/* ── Card CSV ── */}
      <section className="bg-surface/50 border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <FileDown size={24} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-content mb-1">Exportar CSV</h2>
            <p className="text-sm text-muted mb-5">
              Baixe <strong className="text-content">todas</strong> as suas receitas e despesas em um arquivo compatível com Excel (separado por ponto-e-vírgula, UTF-8 com BOM).
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-muted mb-5">
              {['Todas as Receitas', 'Todas as Despesas', 'Com categoria e data'].map(t => (
                <span key={t} className="flex items-center gap-1.5 bg-background/60 border border-border/60 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t}
                </span>
              ))}
            </div>
            <button
              onClick={handleExportCSV}
              disabled={csvLoading}
              className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
            >
              {csvLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Baixar Extrato CSV
            </button>
          </div>
        </div>
      </section>

      {/* ── Card PDF ── */}
      <section className="bg-surface/50 border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <FileText size={24} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-content mb-1">Gerar Relatório PDF</h2>
            <p className="text-sm text-muted mb-5">
              Crie um relatório PDF formatado com cabeçalho, resumo financeiro e tabelas detalhadas de transações — pronto para impressão ou envio.
            </p>

            {/* Period selector */}
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wide flex items-center gap-2">
                  <Calendar size={13} /> Período do Relatório
                </label>
                <div className="relative">
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="w-full appearance-none bg-background/50 border border-border rounded-xl px-4 py-2.5 text-content text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 pr-10"
                  >
                    {PERIOD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted font-medium">Data Inicial</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-content text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted font-medium">Data Final</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-content text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Preview chips */}
            <div className="flex flex-wrap gap-2 text-xs text-muted mb-5">
              {['Cabeçalho FinControl', 'Resumo financeiro', 'Tabela de despesas', 'Tabela de receitas', 'Saldo do período'].map(t => (
                <span key={t} className="flex items-center gap-1.5 bg-background/60 border border-border/60 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> {t}
                </span>
              ))}
            </div>

            <button
              onClick={handleExportPDF}
              disabled={pdfLoading}
              className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              Gerar e Baixar PDF
              {period !== 'custom' && <span className="text-xs opacity-60 ml-1">· {periodLabel}</span>}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
