import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, LogOut, Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { signOut, showBalances, setShowBalances } = useAuth();
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Rendas', path: '/incomes', icon: DollarSign },
    { name: 'Despesas', path: '/expenses', icon: CreditCard },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          FinControl
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive 
                  ? "bg-zinc-800 text-emerald-400" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              )}
            >
              <Icon size={20} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-2">
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            location.pathname.startsWith('/settings') 
              ? "bg-zinc-800 text-emerald-400" 
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          )}
        >
          <SettingsIcon size={20} />
          <span className="font-medium">Configurações</span>
        </Link>
      </div>

      <div className="p-4 border-t border-zinc-800 flex items-center justify-between gap-2">
        <button 
          onClick={() => setShowBalances(!showBalances)}
          className="flex items-center justify-center p-2 text-zinc-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-zinc-800/50"
          title={showBalances ? "Ocultar Valores" : "Mostrar Valores"}
        >
          {showBalances ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        <button 
          onClick={() => signOut()}
          className="flex flex-1 items-center justify-center gap-2 p-2 text-zinc-400 hover:text-red-400 transition-colors rounded-lg hover:bg-zinc-800/50"
          title="Sair"
        >
          <LogOut size={20} />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
