import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, TrendingDown, RefreshCcw, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import UserAvatar from '../components/common/UserAvatar';

const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const fmtBRLShort = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

export default function Dashboard() {
  const { user, profile, showBalances, activeGroupId } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [evolutionData, setEvolutionData] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  
  useEffect(() => {
    if (activeGroupId) {
      fetchDashboardData();
      fetchNotifications();
      fetchRecentTransactions();
    }
  }, [user, currentMonth, profile, activeGroupId]);

  const fetchNotifications = async () => {
    if (!profile?.notificar_vencimentos || !activeGroupId) {
      setNotifications([]);
      return;
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // We look up to X days ahead
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + (profile.dias_antecedencia || 7));
    const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth()+1).padStart(2,'0')}-${String(maxDate.getDate()).padStart(2,'0')}T23:59:59`;

    const { data: pendingExpenses } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date, expense_type, cards(name)')
      .eq('grupo_id', activeGroupId)
      .eq('status', 'pending')
      .lte('expense_date', maxDateStr)
      .order('expense_date', { ascending: true });

    if (pendingExpenses) {
      const alerts = pendingExpenses.map(exp => {
         const expDate = new Date(exp.expense_date + "T00:00:00");
         const diffTime = expDate - today;
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         
         let urgency = 'warning';
         let message = `Vence em ${diffDays} dia${diffDays>1?'s':''}`;
         
         if (diffDays < 0) {
            urgency = 'danger';
            message = `Atrasada há ${Math.abs(diffDays)} dia${Math.abs(diffDays)>1?'s':''}`;
         } else if (diffDays === 0) {
            urgency = 'danger';
            message = 'Vence HOJE';
         }

         return { ...exp, diffDays, urgency, message };
      });
      setNotifications(alerts);
    }
  };

  const fetchDashboardData = async () => {
    if (!activeGroupId) return;
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth(); // 0-indexed
      const monthStr = String(month + 1).padStart(2, '0');
      const lastDayNum = new Date(year, month + 1, 0).getDate();
      
      const firstDay = `${year}-${monthStr}-01T00:00:00`;
      const lastDay = `${year}-${monthStr}-${lastDayNum}T23:59:59`;
      const incomeMonthStr = `${year}-${monthStr}-01`;

      const { data: incomes } = await supabase.from('incomes').select('net_amount, gross_amount, discounts').eq('month', incomeMonthStr).eq('grupo_id', activeGroupId);
      const sumIncome = incomes?.reduce((acc, curr) => acc + (curr.net_amount !== undefined ? Number(curr.net_amount) : Number(curr.gross_amount) - Number(curr.discounts || 0)), 0) || 0;
      setTotalIncome(sumIncome);

      const { data: expenses } = await supabase.from('expenses').select('amount, categories(name, color)').gte('expense_date', firstDay).lte('expense_date', lastDay).eq('grupo_id', activeGroupId);
      const sumExpense = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      setTotalExpense(sumExpense);

      if (expenses) {
        const grouped = expenses.reduce((acc, current) => {
          const catName = current.categories?.name || 'Geral';
          const color = current.categories?.color || '#a1a1aa';
          if (!acc[catName]) acc[catName] = { name: catName, value: 0, color };
          acc[catName].value += Number(current.amount);
          return acc;
        }, {});
        setExpensesByCategory(Object.values(grouped).sort((a, b) => b.value - a.value));
      }

      const d6 = new Date(year, month - 5, 1);
      const sixMonthsAgo = `${d6.getFullYear()}-${String(d6.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
      const { data: evolExpenses } = await supabase.from('expenses').select('amount, expense_date').gte('expense_date', sixMonthsAgo).lte('expense_date', lastDay).eq('grupo_id', activeGroupId);
        
      if (evolExpenses) {
        const monthlyTotals = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date(year, month - i, 1);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
          monthlyTotals[monthKey] = { name: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).replace('.', ''), total: 0 };
        }
        evolExpenses.forEach(exp => {
          const mKey = exp.expense_date.substring(0, 7);
          if (monthlyTotals[mKey]) monthlyTotals[mKey].total += Number(exp.amount);
        });
        setEvolutionData(Object.values(monthlyTotals));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTransactions = async () => {
    if (!activeGroupId) return;
    const { data: exps } = await supabase.from('expenses').select('id, description, amount, expense_date, type:expense_type, profiles(full_name, avatar_url, email)').eq('grupo_id', activeGroupId).order('expense_date', { ascending: false }).limit(5);
    setRecentTransactions(exps || []);
  };

  const goPrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const balance = totalIncome - totalExpense;
  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted mt-1 text-sm md:text-base">Resumo das finanças e histórico</p>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 bg-surface/80 border border-border p-2 rounded-xl">
          <button onClick={goPrevMonth} className="p-1.5 hover:bg-border rounded-lg text-muted hover:text-content transition-colors"><ChevronLeft size={20} /></button>
          <span className="min-w-[120px] md:min-w-[140px] text-center font-medium capitalize text-content text-sm md:text-base">{monthName}</span>
          <button onClick={goNextMonth} className="p-1.5 hover:bg-border rounded-lg text-muted hover:text-content transition-colors"><ChevronRight size={20} /></button>
          <div className="hidden sm:block w-px h-6 bg-border mx-1"></div>
          <button onClick={() => { fetchDashboardData(); fetchNotifications(); }} className="hidden sm:block p-1.5 hover:bg-border rounded-lg text-muted hover:text-content transition-colors" title="Atualizar">
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* IN-APP NOTIFICATION BELLS */}
      {notifications.length > 0 && (
        <div className="flex flex-col gap-3">
          {notifications.map(notif => (
            <div key={notif.id} className={cn("p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4", notif.urgency === 'danger' ? "bg-rose-500/10 border-rose-500/30" : "bg-amber-500/10 border-amber-500/30")}>
               <div className="flex items-start sm:items-center gap-4">
                 <div className={cn("p-2.5 rounded-full flex-shrink-0 relative", notif.urgency === 'danger' ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500")}>
                    <Bell size={20} className={notif.urgency === 'danger' ? 'animate-pulse' : ''} />
                    {notif.urgency === 'danger' && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-surface animate-ping"></span>}
                 </div>
                 <div>
                   <p className="font-semibold text-content text-sm md:text-base flex flex-wrap items-center gap-2">
                     {notif.description} 
                     {notif.expense_type === 'loan' && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold border border-purple-500/30">Empréstimo</span>}
                     {notif.cards?.name ? (
                       <span className="text-[10px] bg-zinc-500/20 text-muted px-1.5 py-0.5 rounded uppercase border border-border">💳 {notif.cards.name}</span>
                     ) : (
                       <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded uppercase border border-emerald-500/30">💸 Débito</span>
                     )}
                   </p>
                   <p className={cn("text-xs md:text-sm font-medium mt-1 uppercase tracking-wide", notif.urgency === 'danger' ? "text-rose-400" : "text-amber-500")}>
                     {notif.message} <span className="text-content opacity-50 px-1">•</span> <span className="font-bold">{formatCurrency(notif.amount)}</span>
                   </p>
                 </div>
               </div>
               <Link to="/expenses" className="text-xs md:text-sm px-4 py-2 font-medium bg-background text-content rounded-lg border border-border hover:bg-surface transition-colors flex items-center justify-center gap-2 whitespace-nowrap self-end sm:self-auto">
                 Pagar Agora <ChevronRight size={14}/>
               </Link>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-surface/60 border border-border rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-border transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={80} /></div>
          <p className="text-muted font-medium mb-1 relative z-10 text-sm md:text-base">Saldo Líquido</p>
          <h2 className={`text-2xl md:text-3xl lg:text-4xl font-bold relative z-10 ${balance >= 0 ? 'text-primary-glow' : 'text-red-400'}`}>{formatCurrency(balance)}</h2>
        </div>
        <div className="bg-surface/60 border border-border rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-border transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={80} /></div>
          <p className="text-muted font-medium mb-1 relative z-10 text-sm md:text-base">Rendas do Mês</p>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-content relative z-10">{formatCurrency(totalIncome)}</h2>
        </div>
        <div className="bg-surface/60 border border-border rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-border transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown size={80} /></div>
          <p className="text-muted font-medium mb-1 relative z-10 text-sm md:text-base">Despesas do Mês</p>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-rose-400 relative z-10">{formatCurrency(totalExpense)}</h2>
        </div>
      </div>

      {/* Comparative Chart */}
      <div className="bg-surface/40 border border-border rounded-2xl p-5 md:p-6 w-full overflow-hidden">
        <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6 flex items-center gap-2 text-content">
          <TrendingDown className="text-rose-400" size={20} /> Evolução de Gastos
        </h3>
        <div className="h-48 sm:h-64 md:h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolutionData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => showBalances ? fmtBRLShort(val) : '****'} width={80} />
              <BarTooltip
                cursor={{ fill: '#27272a', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}
                itemStyle={{ color: '#fb7185', fontWeight: 'bold' }}
                formatter={(value, name) => [showBalances ? fmtBRL(value) : 'R$ ****', 'Gastos']}
              />
              <Bar dataKey="total" name="Gastos" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
         {/* Categories Pie Chart */}
         <div className="bg-surface/40 border border-border rounded-2xl p-5 md:p-6 w-full">
           <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6 text-content">Despesas por Categoria</h3>
           {expensesByCategory.length > 0 ? (
             <>
               <div className="h-56 md:h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expensesByCategory} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{expensesByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><PieTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5', fontSize: '12px' }} itemStyle={{ color: '#fff' }}/></PieChart></ResponsiveContainer></div>
               <div className="flex flex-wrap gap-2 md:gap-4 mt-6 justify-center">
                 {expensesByCategory.map(cat => (
                   <div key={cat.name} className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted bg-background/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-border">
                     <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} /> {cat.name} <span className="opacity-70 text-[10px] md:text-xs">({formatCurrency(cat.value)})</span>
                   </div>
                 ))}
               </div>
             </>
           ) : <div className="h-48 md:h-64 flex items-center justify-center text-muted border border-dashed border-border/50 rounded-xl text-sm">Sem despesas neste mês.</div>}
         </div>
         
          {/* Recent Transactions List with Identity */}
          <div className="bg-surface/40 border border-border rounded-2xl p-5 md:p-6 w-full">
            <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6 text-content">Últimas Transações</h3>
            <div className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-background/40 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <UserAvatar nameOrEmail={tx.profiles?.full_name || tx.profiles?.email} size="sm" />
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-content truncate leading-tight">{tx.description}</p>
                        <p className="text-[10px] text-muted mt-0.5">{new Date(tx.expense_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-rose-400 whitespace-nowrap">
                      -{fmtBRL(tx.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-center text-muted py-4">Nenhuma transação recente no grupo.</p>
              )}
            </div>
            <Link to="/expenses" className="block text-center text-xs text-primary-glow font-bold mt-6 hover:underline">Ver todas</Link>
          </div>
          
          {/* Intelligent Insights */}
          <div className="bg-surface/40 border border-border rounded-2xl p-5 md:p-6 w-full">
             <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6 text-content">Insights do Mês</h3>
             <div className="space-y-3 md:space-y-4">
                {totalExpense > totalIncome && totalIncome > 0 && (
                  <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                     <p className="text-red-400 font-medium text-sm md:text-base flex items-center gap-2">⚠️ Atenção ao seu orçamento!</p>
                     <p className="text-xs md:text-sm text-red-400/80 mt-1">Suas despesas superaram suas rendas neste mês. Considere rever seus gastos com {expensesByCategory[0]?.name}.</p>
                  </div>
                )}
                {expensesByCategory.length > 0 && (
                  <div className="p-3 md:p-4 bg-background/50 border border-border rounded-xl">
                     <p className="text-muted font-medium text-sm md:text-base">💡 Maior Gasto</p>
                     <p className="text-xs md:text-sm text-muted mt-1">A categoria <span className="text-content font-bold">{expensesByCategory[0]?.name}</span> representa <span className="text-rose-400 font-bold">{((expensesByCategory[0]?.value / totalExpense) * 100).toFixed(1)}%</span> das suas despesas.</p>
                  </div>
                )}
                {balance > 0 && (
                  <div className="p-3 md:p-4 bg-primary/10 border border-primary/20 rounded-xl">
                     <p className="text-primary-glow font-medium text-sm md:text-base">🎉 Parabéns!</p>
                     <p className="text-xs md:text-sm text-primary-glow/80 mt-1">Seu balanço está positivo. Excelente gestão financeira neste mês!</p>
                  </div>
                )}
                {totalExpense === 0 && totalIncome === 0 && (
                  <div className="p-4 text-center text-muted text-sm md:text-base">Nenhuma movimentação registrada.<br className="hidden md:block" />Comece adicionando rendas ou despesas.</div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}

// UserAvatarBadge removido em favor do componente centralizado UserAvatar
