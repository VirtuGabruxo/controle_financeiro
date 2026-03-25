import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  
  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: incomes } = await supabase
        .from('incomes')
        .select('net_amount');
        
      const sumIncome = incomes?.reduce((acc, curr) => acc + Number(curr.net_amount), 0) || 0;
      setTotalIncome(sumIncome);

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, categories(name, color)')
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay);

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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const balance = totalIncome - totalExpense;
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Resumo das suas finanças neste mês</p>
        </div>
        <button onClick={fetchDashboardData} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors group">
          <RefreshCcw size={20} className="text-zinc-400 group-hover:text-zinc-100" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <p className="text-zinc-400 font-medium mb-1 relative z-10">Saldo Líquido</p>
          <h2 className={`text-4xl font-bold relative z-10 ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
             {formatCurrency(balance)}
          </h2>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <p className="text-zinc-400 font-medium mb-1 relative z-10">Total de Rendas</p>
          <h2 className="text-4xl font-bold text-zinc-50 relative z-10">
             {formatCurrency(totalIncome)}
          </h2>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown size={80} />
          </div>
          <p className="text-zinc-400 font-medium mb-1 relative z-10">Despesas do Mês</p>
          <h2 className="text-4xl font-bold text-rose-400 relative z-10">
             {formatCurrency(totalExpense)}
          </h2>
        </div>
      </div>

      {expensesByCategory.length > 0 && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
             <h3 className="text-lg font-semibold mb-6">Despesas por Categoria</h3>
             <div className="h-72">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={expensesByCategory}
                     innerRadius={60}
                     outerRadius={100}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {expensesByCategory.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <Tooltip 
                     formatter={(value) => formatCurrency(value)}
                     contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                     itemStyle={{ color: '#fff' }}
                   />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="flex flex-wrap gap-4 mt-4 justify-center">
               {expensesByCategory.map(cat => (
                 <div key={cat.name} className="flex items-center gap-2 text-sm text-zinc-300">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                   {cat.name} ({formatCurrency(cat.value)})
                 </div>
               ))}
             </div>
           </div>
           
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-6 text-zinc-100">Insights Inteligentes</h3>
              <div className="space-y-4">
                 {totalExpense > totalIncome && totalIncome > 0 && (
                   <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400 font-medium flex items-center gap-2">⚠️ Atenção ao seu orçamento!</p>
                      <p className="text-sm text-red-400/80 mt-1">Suas despesas superaram suas rendas neste mês. Considere rever seus gastos com {expensesByCategory[0]?.name}.</p>
                   </div>
                 )}
                 
                 {expensesByCategory.length > 0 && (
                   <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                      <p className="text-zinc-300 font-medium">💡 Maior Gasto do Mês</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        A categoria <span className="text-zinc-200 font-bold">{expensesByCategory[0]?.name}</span> representa <span className="text-rose-400 font-bold">{((expensesByCategory[0]?.value / totalExpense) * 100).toFixed(1)}%</span> das suas despesas totais (este mês).
                      </p>
                   </div>
                 )}
                 
                 {balance > 0 && (
                   <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-emerald-400 font-medium">🎉 Parabéns!</p>
                      <p className="text-sm text-emerald-400/80 mt-1">Seu saldo está positivo. Que tal poupar ou investir parte de {formatCurrency(balance)}?</p>
                   </div>
                 )}
              </div>
           </div>
         </div>
      )}
    </div>
  );
}
