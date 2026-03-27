import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LineChart as LineIcon, Loader2, Wallet, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function NetWorth() {
  const { user, showBalances, activeGroupId } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [accumulatedData, setAccumulatedData] = useState([]);
  const [currentNetWorth, setCurrentNetWorth] = useState(0);

  useEffect(() => {
    if (activeGroupId) {
      fetchHistory();
    }
  }, [user, activeGroupId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch data for the active group
      const { data: incomes } = await supabase.from('incomes').select('net_amount, month').eq('grupo_id', activeGroupId).order('month', { ascending: true });
      const { data: expenses } = await supabase.from('expenses').select('amount, expense_date').eq('grupo_id', activeGroupId).order('expense_date', { ascending: true });
      
      const timeline = {};
      
      // Inject incomes tracking month YYYY-MM
      (incomes || []).forEach(inc => {
        const mKey = inc.month.substring(0, 7);
        if(!timeline[mKey]) timeline[mKey] = { inc: 0, exp: 0 };
        timeline[mKey].inc += Number(inc.net_amount || 0);
      });

      // Inject expenses tracking month YYYY-MM
      (expenses || []).forEach(exp => {
         const mKey = exp.expense_date.substring(0, 7);
         if(!timeline[mKey]) timeline[mKey] = { inc: 0, exp: 0 };
         timeline[mKey].exp += Number(exp.amount || 0);
      });

      // Sort chronological
      const sortedKeys = Object.keys(timeline).sort((a,b) => new Date(a) - new Date(b));
      
      const chartData = [];
      let runningBalance = 0;

      sortedKeys.forEach(k => {
         const [y, m] = k.split('-');
         const d = new Date(y, m - 1, 1);
         const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(d);
         
         const netMonth = timeline[k].inc - timeline[k].exp;
         runningBalance += netMonth;

         chartData.push({
           name: label,
           "Patrimônio Acumulado": runningBalance,
           rawIso: k
         });
      });

      setAccumulatedData(chartData);
      setCurrentNetWorth(runningBalance);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => showBalances ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'R$ ****';

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12 w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Balanço Geral</h1>
        <p className="text-muted mt-1 text-sm md:text-base">Acompanhe a evolução histórica do seu patrimônio (Rendas Totais - Gastos Totais)</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-muted"><Loader2 className="animate-spin" /></div>
      ) : accumulatedData.length === 0 ? (
        <div className="bg-surface/30 border border-border/50 border-dashed rounded-2xl p-12 text-center text-muted flex flex-col items-center">
            <Wallet size={48} className="text-zinc-700 mb-4" />
            <p>Nenhuma movimentação histórica capturada.</p>
        </div>
      ) : (
        <div className="space-y-6">
           
           <div className="bg-surface/80 border border-border rounded-2xl p-8 relative overflow-hidden flex flex-col items-center justify-center text-center shadow-2xl">
              <div className="absolute -top-10 -left-10 text-indigo-500/10"><LineIcon size={200} /></div>
              <div className="absolute -bottom-10 -right-10 text-primary/10"><TrendingUp size={200} /></div>

              <span className="text-sm md:text-base text-muted font-semibold tracking-widest uppercase mb-2 relative z-10">Patrimônio Atual Consolidado</span>
              <h2 className={`text-4xl md:text-6xl font-black relative z-10 tracking-tight ${currentNetWorth >= 0 ? 'text-primary-glow' : 'text-rose-400'}`}>
                 {formatCurrency(currentNetWorth)}
              </h2>
           </div>

           <div className="bg-surface/60 border border-border rounded-2xl p-6 h-[400px] md:h-[500px] w-full mt-8">
              <h3 className="text-lg font-semibold text-content flex items-center gap-2 mb-6">
                 <TrendingUp className="text-indigo-400" size={20} /> Histórico de Crescimento Acumulado
              </h3>
              <div className="h-full w-full pb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={accumulatedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPatrimonioNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb7185" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => showBalances ? `R$ ${val}` : '**'} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Area 
                       type="monotone" 
                       dataKey="Patrimônio Acumulado" 
                       stroke={currentNetWorth >= 0 ? "#818cf8" : "#fb7185"} 
                       strokeWidth={4}
                       fillOpacity={1} 
                       fill={currentNetWorth >= 0 ? "url(#colorPatrimonio)" : "url(#colorPatrimonioNeg)"} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
