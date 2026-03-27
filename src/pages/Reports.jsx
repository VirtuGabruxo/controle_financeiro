import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PieChart as PieIcon, BarChart3, LineChart as LineIcon, Loader2, ListOrdered, Save, RefreshCw, Bookmark, Filter, Settings2, Trash2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { cn } from '../lib/utils';

export default function Reports() {
  const { user, showBalances, activeGroupId } = useAuth();
  
  // Core Filter Data
  const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const defaultEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  const [filters, setFilters] = useState({
    startDate: defaultStart,
    endDate: defaultEnd,
    type: 'expenses', // 'expenses', 'incomes', 'both'
    categoryId: 'all',
    cardId: 'all'
  });

  // UI Control
  const [chartType, setChartType] = useState('pie'); // 'pie', 'bar', 'line'
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [cardsList, setCardsList] = useState([]);

  // Saved Reports Config
  const [savedReports, setSavedReports] = useState([]);
  const [reportName, setReportName] = useState('');
  
  useEffect(() => {
    // Load local storage saved reports
    const local = localStorage.getItem('fincontrol_reports');
    if (local) setSavedReports(JSON.parse(local));

    fetchOptions();
  }, []);

  useEffect(() => {
    if (activeGroupId) {
      fetchData();
    }
  }, [user, filters, activeGroupId]);

  const fetchOptions = async () => {
    if (!activeGroupId) return;
    const { data: cat } = await supabase.from('categories').select('id, name').or(`grupo_id.eq.${activeGroupId},user_id.is.null`);
    if(cat) setCategoriesList(cat);
    const { data: crd } = await supabase.from('cards').select('id, name').eq('grupo_id', activeGroupId);
    if(crd) setCardsList(crd);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let expData = [];
      let incData = [];
      
      const { startDate, endDate, type, categoryId, cardId } = filters;

      if (type === 'expenses' || type === 'both') {
        let q = supabase.from('expenses')
           .select('id, amount, description, expense_date, card_id, categories(id, name, color), cards(name)')
           .eq('grupo_id', activeGroupId)
           .gte('expense_date', startDate)
           .lte('expense_date', endDate + 'T23:59:59');

        if (categoryId !== 'all') q = q.eq('category_id', categoryId);
        
        if (cardId !== 'all') {
           if (cardId === 'debit') q = q.is('card_id', null);
           else q = q.eq('card_id', cardId);
        }
        
        const { data } = await q;
        expData = data || [];
      }

      if (type === 'incomes' || type === 'both') {
        const { data } = await supabase.from('incomes')
           .select('id, description, type, gross_amount, discounts, net_amount, month')
           .eq('grupo_id', activeGroupId)
           .gte('month', startDate)
           .lte('month', endDate + 'T23:59:59');
        
        incData = data || [];
      }

      setExpenses(expData);
      setIncomes(incData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';

  // Saving Logic
  const handleSaveReport = () => {
    if(!reportName) return alert('Digite um nome para salvar a predefinição.');
    const newReport = { id: Date.now(), name: reportName, filters, chartType };
    const updated = [...savedReports, newReport];
    setSavedReports(updated);
    localStorage.setItem('fincontrol_reports', JSON.stringify(updated));
    setReportName('');
  };
  const handleLoadReport = (rep) => {
    setFilters(rep.filters);
    setChartType(rep.chartType);
  };
  const handleDeleteReport = (id) => {
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem('fincontrol_reports', JSON.stringify(updated));
  }

  /* ---- DATA PROCESSING FOR CHARTS ---- */
  let chartData = [];
  let totalSum = 0;
  
  if (chartType === 'pie') {
     if (filters.type === 'both') {
       const sumE = expenses.reduce((acc, c) => acc + Number(c.amount), 0);
       const sumI = incomes.reduce((acc, c) => acc + Number(c.net_amount !== undefined ? c.net_amount : (c.gross_amount - (c.discounts||0))), 0);
       chartData = [
         { name: 'Receitas', value: sumI, color: '#34d399' },
         { name: 'Despesas', value: sumE, color: '#fb7185' }
       ];
       totalSum = sumI + sumE;
     } else if (filters.type === 'expenses') {
       const map = expenses.reduce((acc, curr) => {
         const name = curr.categories?.name || 'Outros';
         const color = curr.categories?.color || '#a1a1aa';
         if (!acc[name]) acc[name] = { name, value: 0, color };
         acc[name].value += Number(curr.amount);
         return acc;
       }, {});
       chartData = Object.values(map).sort((a,b) => b.value - a.value);
       totalSum = chartData.reduce((acc, c) => acc + c.value, 0);
     } else {
       const map = incomes.reduce((acc, curr) => {
         const name = curr.type || 'Geral';
         const color = name === 'Salário' ? '#60a5fa' : name === 'Extra' ? '#fb923c' : '#c084fc';
         if (!acc[name]) acc[name] = { name, value: 0, color };
         acc[name].value += Number(curr.net_amount !== undefined ? curr.net_amount : (curr.gross_amount - (curr.discounts||0)));
         return acc;
       }, {});
       chartData = Object.values(map).sort((a,b) => b.value - a.value);
       totalSum = chartData.reduce((acc, c) => acc + c.value, 0);
     }
  } else if (chartType === 'bar' || chartType === 'line') {
     // Timeline building (By Month YYYY-MM)
     const tm = {};
     expenses.forEach(e => {
        const k = e.expense_date.substring(0, 7);
        if(!tm[k]) tm[k] = { Receitas: 0, Despesas: 0 };
        tm[k].Despesas += Number(e.amount);
     });
     incomes.forEach(i => {
        const k = i.month.substring(0, 7);
        if(!tm[k]) tm[k] = { Receitas: 0, Despesas: 0 };
        tm[k].Receitas += Number(i.net_amount !== undefined ? i.net_amount : (i.gross_amount - (i.discounts||0)));
     });
     
     chartData = Object.keys(tm).sort().map(k => {
       const [y, m] = k.split('-');
       const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(y, m - 1, 1));
       return { name: `${label}/${y.substring(2)}`, ...tm[k] };
     });
  }

  // Top 5 Calculation (Only makes sense for expenses/incomes lists directly)
  const topExpenses = [...expenses].sort((a,b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Construtor de Relatórios</h1>
          <p className="text-muted mt-1 text-sm md:text-base">Análises dinâmicas e flexíveis dos seus registros</p>
        </div>
        
        {/* Toggle Charts */}
        <div className="flex bg-surface border border-border p-1.5 rounded-xl self-start">
           <button onClick={() => setChartType('pie')} className={cn("p-2 rounded-lg transition-colors flex items-center justify-center", chartType==='pie'?"bg-border text-cyan-400":"text-muted hover:text-muted")} title="Distribuição"><PieIcon size={20}/></button>
           <button onClick={() => setChartType('bar')} className={cn("p-2 rounded-lg transition-colors flex items-center justify-center", chartType==='bar'?"bg-border text-primary-glow":"text-muted hover:text-muted")} title="Barras (Evolução)"><BarChart3 size={20}/></button>
           <button onClick={() => setChartType('line')} className={cn("p-2 rounded-lg transition-colors flex items-center justify-center", chartType==='line'?"bg-border text-indigo-400":"text-muted hover:text-muted")} title="Linhas (Tendência)"><LineIcon size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Painel de Filtros e Atalhos */}
        <div className="space-y-6">
           <div className="bg-surface/80 border border-border rounded-2xl p-5">
             <h3 className="text-content font-semibold flex items-center gap-2 mb-4"><Filter size={18} className="text-cyan-400"/> Filtros Dinâmicos</h3>
             
             <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-medium">Período (Início e Fim)</label>
                  <div className="flex flex-col gap-2">
                    <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-content text-sm focus:ring-1 focus:ring-cyan-500 [color-scheme:dark]" />
                    <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-content text-sm focus:ring-1 focus:ring-cyan-500 [color-scheme:dark]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-medium">Movimentação</label>
                  <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-content text-sm focus:ring-1 focus:ring-cyan-500">
                     <option value="both">Fluxo de Caixa (Ambos)</option>
                     <option value="expenses">Apenas Despesas</option>
                     <option value="incomes">Apenas Receitas</option>
                  </select>
                </div>

                {filters.type !== 'incomes' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted font-medium">Categoria Específica</label>
                      <select value={filters.categoryId} onChange={e => setFilters({...filters, categoryId: e.target.value})} className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-content text-sm focus:ring-1 focus:ring-cyan-500">
                         <option value="all">Todas as Categorias</option>
                         {categoriesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted font-medium">Forma de Pag. (Cartão/Conta)</label>
                      <select value={filters.cardId} onChange={e => setFilters({...filters, cardId: e.target.value})} className="w-full bg-background/50 border border-border rounded-lg px-3 py-2.5 text-content text-sm focus:ring-1 focus:ring-cyan-500">
                         <option value="all">Todas</option>
                         <option value="debit">Apenas Débito/Pix</option>
                         {cardsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
             </div>
             
             {/* Save Box */}
             <div className="mt-6 pt-5 border-t border-border/80">
                <div className="flex gap-2">
                  <input type="text" placeholder="Nomeie este filtro..." value={reportName} onChange={e=>setReportName(e.target.value)} className="w-full bg-background/50 border border-border rounded-lg px-3 text-xs text-content focus:outline-none" />
                  <button onClick={handleSaveReport} className="bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 px-3 py-2 rounded-lg transition-colors flex items-center justify-center shrink-0">
                    <Save size={16} />
                  </button>
                </div>
             </div>
           </div>

           {/* Saved Reports List */}
           {savedReports.length > 0 && (
             <div className="bg-surface/80 border border-border rounded-2xl p-5">
               <h3 className="text-content font-semibold flex items-center gap-2 mb-3"><Bookmark size={18} className="text-rose-400"/> Salvos</h3>
               <div className="space-y-2">
                 {savedReports.map(r => (
                   <div key={r.id} className="flex justify-between items-center bg-background/50 p-2.5 rounded-lg border border-border/50 group">
                      <button onClick={()=>handleLoadReport(r)} className="text-left flex-1 text-sm text-muted font-medium truncate group-hover:text-cyan-400 transition-colors">
                         {r.name}
                      </button>
                      <button onClick={()=>handleDeleteReport(r.id)} className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                   </div>
                 ))}
               </div>
             </div>
           )}
        </div>

        {/* Visão de Dados */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-surface/60 border border-border rounded-2xl p-6 min-h-[400px] flex flex-col">
             
             {loading ? (
               <div className="flex-1 flex justify-center items-center text-muted gap-2"><Loader2 className="animate-spin" /> Processando dados...</div>
             ) : (expenses.length===0 && incomes.length===0) ? (
               <div className="flex-1 flex justify-center items-center text-muted border border-dashed border-border/80 rounded-xl bg-surface/20">
                 Nenhum dado encontrado para os filtros selecionados.
               </div>
             ) : (
               <>
                 <div className="w-full h-[350px] md:h-[400px]">
                   <ResponsiveContainer width="100%" height="100%">
                     {chartType === 'pie' ? (
                       <PieChart>
                         <Pie data={chartData} innerRadius={80} outerRadius={120} paddingAngle={4} dataKey="value" stroke="none">
                           {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} /> )}
                         </Pie>
                         <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}/>
                       </PieChart>
                     ) : chartType === 'bar' ? (
                       <BarChart data={chartData} margin={{top:20, right:10, left:0, bottom:0}}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                         <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                         <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val)=>`R$ ${val}`} width={100} />
                         <Tooltip cursor={{fill: '#27272a', opacity: 0.4}} formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }} />
                         <Legend />
                         {filters.type !== 'expenses' && <Bar dataKey="Receitas" fill="#10b981" radius={[4,4,0,0]} maxBarSize={60} />}
                         {filters.type !== 'incomes' && <Bar dataKey="Despesas" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={60} />}
                       </BarChart>
                     ) : (
                       <LineChart data={chartData} margin={{top:20, right:10, left:0, bottom:0}}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                         <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                         <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val)=>`R$ ${val}`} width={100} />
                         <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }} />
                         <Legend />
                         {filters.type !== 'expenses' && <Line type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />}
                         {filters.type !== 'incomes' && <Line type="monotone" dataKey="Despesas" stroke="#f43f5e" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />}
                       </LineChart>
                     )}
                   </ResponsiveContainer>
                 </div>

                 {/* Sumário Inferior para Gráfico de Pizza (Legend Customizada) */}
                 {chartType === 'pie' && chartData.length > 0 && (
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
                     {chartData.map(c => {
                       const pct = totalSum > 0 ? ((c.value / totalSum) * 100).toFixed(1) : 0;
                       return (
                         <div key={c.name} className="flex flex-col border border-border/50 bg-background/30 p-3 rounded-xl">
                           <div className="flex justify-between items-start mb-1">
                             <div className="flex items-center gap-2">
                               <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: c.color}}></span>
                               <span className="text-xs text-muted font-medium truncate block max-w-[80px]">{c.name}</span>
                             </div>
                             <span className="text-[10px] text-muted font-bold">{pct}%</span>
                           </div>
                           <span className="text-sm font-bold text-content">{formatCurrency(c.value)}</span>
                         </div>
                       )
                     })}
                   </div>
                 )}
               </>
             )}
           </div>

           {/* Top 5 (Aparece primariamente quando se olha para Despesas Específicas) */}
           {filters.type !== 'incomes' && expenses.length > 0 && (
             <div className="bg-surface/60 border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-content flex items-center gap-2 mb-6">
                  <ListOrdered className="text-rose-400" size={20} /> Top 5 Recortes (Despesas Isoladas)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topExpenses.map((exp, idx) => {
                    const cColor = exp.categories?.color || '#a1a1aa';
                    return (
                      <div key={exp.id} className="flex flex-col p-4 bg-background/60 border border-border/80 rounded-xl hover:bg-surface transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("text-lg font-black italic opacity-50", idx===0 ? "text-amber-400" : idx===1 ? "text-muted" : idx===2 ? "text-amber-700" : "text-zinc-700")}>
                            #{idx+1}
                          </span>
                          <span className="text-[10px] bg-surface px-2 py-0.5 rounded-md border border-border text-muted" style={{color: cColor, borderColor: `${cColor}50`}}>{exp.categories?.name || 'Geral'}</span>
                        </div>
                        <p className="font-semibold text-content truncate flex-1 block">{exp.description}</p>
                        <div className="flex justify-between items-end mt-2">
                          <p className="text-[10px] text-muted">{new Date(exp.expense_date).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</p>
                          <p className="text-base font-bold text-rose-400">{formatCurrency(exp.amount)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
             </div>
           )}

        </div>

      </div>
    </div>
  );
}
