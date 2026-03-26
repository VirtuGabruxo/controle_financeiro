import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, TrendingDown, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';

export default function Dashboard() {
  const { user, showBalances } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [evolutionData, setEvolutionData] = useState([]);
  
  useEffect(() => {
    fetchDashboardData();
  }, [user, currentMonth]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth(); // 0-indexed
      const monthStr = String(month + 1).padStart(2, '0');
      const lastDayNum = new Date(year, month + 1, 0).getDate();
      
      const firstDay = `${year}-${monthStr}-01T00:00:00`;
      const lastDay = `${year}-${monthStr}-${lastDayNum}T23:59:59`;
      
      const incomeMonthStr = `${year}-${monthStr}-01`;

      // 1. Fetch Incomes for Current Month
      const { data: incomes } = await supabase
        .from('incomes')
        .select('net_amount')
        .eq('month', incomeMonthStr)
        .eq('user_id', user.id);
        
      const sumIncome = incomes?.reduce((acc, curr) => acc + Number(curr.net_amount), 0) || 0;
      setTotalIncome(sumIncome);

      // 2. Fetch Expenses for Current Month
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, categories(name, color)')
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay)
        .eq('user_id', user.id);

      const sumExpense = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      setTotalExpense(sumExpense);

      if (expenses) {
        const grouped = expenses.reduce((acc, current) => {
          const catName = current.categories?.name || 'Outros';
          const color = current.categories?.color || '#ccc';
          if (!acc[catName]) acc[catName] = { name: catName, value: 0, color };
          acc[catName].value += Number(current.amount);
          return acc;
        }, {});
        setExpensesByCategory(Object.values(grouped).sort((a, b) => b.value - a.value));
      }

      // 3. Fetch Evolution (last 6 months)
      const d6 = new Date(year, month - 5, 1);
      const sixMonthsAgo = `${d6.getFullYear()}-${String(d6.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
      
      const { data: evolExpenses } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .gte('expense_date', sixMonthsAgo)
        .lte('expense_date', lastDay)
        .eq('user_id', user.id);
        
      if (evolExpenses) {
        const monthlyTotals = {};
        
        for (let i = 5; i >= 0; i--) {
          const d = new Date(year, month - i, 1);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
          monthlyTotals[monthKey] = { 
            name: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).replace('.', ''), 
            total: 0 
          };
        }

        evolExpenses.forEach(exp => {
          const mKey = exp.expense_date.substring(0, 7);
          if (monthlyTotals[mKey]) {
            monthlyTotals[mKey].total += Number(exp.amount);
          }
        });
        
        setEvolutionData(Object.values(monthlyTotals));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const goPrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const balance = totalIncome - totalExpense;
  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Resumo das suas finanças e histórico</p>
        </div>
        
        <div className="flex items-center gap-4 bg-zinc-900/80 border border-zinc-800 p-2 rounded-xl">
          <button onClick={goPrevMonth} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-[140px] text-center font-medium capitalize text-zinc-100">
            {monthName}
          </span>
          <button onClick={goNextMonth} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors">
            <ChevronRight size={20} />
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>
          <button onClick={fetchDashboardData} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors" title="Atualizar">
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <p className="text-zinc-400 font-medium mb-1 relative z-10">Saldo Líquido</p>
          <h2 className={`text-3xl lg:text-4xl font-bold relative z-10 ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
             {formatCurrency(balance)}
          </h2>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <p className="text-zinc-400 font-medium mb-1 relative z-10">Rendas do Mês</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-zinc-50 relative z-10">
             {formatCurrency(totalIncome)}
          </h2>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown size={80} />
          </div>
          <p className="text-zinc-400 font-medium mb-1 relative z-10">Despesas do Mês</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-rose-400 relative z-10">
             {formatCurrency(totalExpense)}
          </h2>
        </div>
      </div>

      {/* Comparative Chart */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-zinc-100">
          <TrendingDown className="text-rose-400" size={20} />
          Evolução de Gastos (Últimos 6 meses)
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                 stroke="#a1a1aa" 
                 fontSize={12} 
                 tickLine={false} 
                 axisLine={false} 
                 tickFormatter={(val) => showBalances ? `R$ ${val}` : '**'} 
              />
              <BarTooltip 
                 formatter={(value) => formatCurrency(value)}
                 cursor={{ fill: '#27272a', opacity: 0.4 }}
                 contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}
                 itemStyle={{ color: '#fb7185', fontWeight: 'bold' }}
              />
              <Bar dataKey="total" fill="#fb7185" radius={[6, 6, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Categories Pie Chart */}
         <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
           <h3 className="text-lg font-semibold mb-6 text-zinc-100">Despesas por Categoria</h3>
           {expensesByCategory.length > 0 ? (
             <>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={expensesByCategory}
                       innerRadius={60}
                       outerRadius={90}
                       paddingAngle={5}
                       dataKey="value"
                       stroke="none"
                     >
                       {expensesByCategory.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <PieTooltip 
                       formatter={(value) => formatCurrency(value)}
                       contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                       itemStyle={{ color: '#fff' }}
                     />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
               <div className="flex flex-wrap gap-4 mt-6 justify-center">
                 {expensesByCategory.map(cat => (
                   <div key={cat.name} className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-800">
                     <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} />
                     {cat.name} <span className="text-zinc-500 text-xs">({formatCurrency(cat.value)})</span>
                   </div>
                 ))}
               </div>
             </>
           ) : (
              <div className="h-64 flex items-center justify-center text-zinc-500 border border-dashed border-zinc-800/50 rounded-xl">
                Sem despesas neste mês.
              </div>
           )}
         </div>
         
         {/* Intelligent Insights */}
         <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-6 text-zinc-100">Insights do Mês</h3>
            <div className="space-y-4">
               {totalExpense > totalIncome && totalIncome > 0 && (
                 <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 font-medium flex items-center gap-2">⚠️ Atenção ao seu orçamento!</p>
                    <p className="text-sm text-red-400/80 mt-1">Suas despesas superaram suas rendas neste mês. Considere rever seus gastos com {expensesByCategory[0]?.name}.</p>
                 </div>
               )}
               
               {expensesByCategory.length > 0 && (
                 <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                    <p className="text-zinc-300 font-medium">💡 Maior Gasto</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      A categoria <span className="text-zinc-200 font-bold">{expensesByCategory[0]?.name}</span> representa <span className="text-rose-400 font-bold">{((expensesByCategory[0]?.value / totalExpense) * 100).toFixed(1)}%</span> das suas despesas totais.
                    </p>
                 </div>
               )}
               
               {balance > 0 && (
                 <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-emerald-400 font-medium">🎉 Parabéns!</p>
                    <p className="text-sm text-emerald-400/80 mt-1">Seu balanço está positivo. Excelente gestão financeira neste mês!</p>
                 </div>
               )}

               {totalExpense === 0 && totalIncome === 0 && (
                 <div className="p-4 text-center text-zinc-500">
                    Nenhuma movimentação registrada.<br/>Comece adicionando rendas ou despesas.
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
