import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, LogOut, Settings as SettingsIcon, Eye, EyeOff, Target, PieChart, LineChart } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { signOut, showBalances, setShowBalances, user, profile } = useAuth();
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Rendas', path: '/incomes', icon: DollarSign },
    { name: 'Despesas', path: '/expenses', icon: CreditCard },
    { name: 'Meus Cartões', path: '/cards', icon: CreditCard },
    { name: 'Caixinhas & Metas', path: '/goals', icon: Target },
    { name: 'Relatórios', path: '/reports', icon: PieChart },
    { name: 'Balanço Geral', path: '/net-worth', icon: LineChart },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border flex-shrink-0 relative">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary-glow to-cyan-400 bg-clip-text text-transparent">
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
                  ? "bg-border text-primary-glow" 
                  : "text-muted hover:text-content hover:bg-border/50"
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
              ? "bg-border text-primary-glow" 
              : "text-muted hover:text-content hover:bg-border/50"
          )}
        >
          <SettingsIcon size={20} />
          <span className="font-medium">Configurações</span>
        </Link>
      </div>

      <div className="p-4 border-t border-border flex flex-col gap-3 mt-auto">
        {/* Profile Card */}
        <div className="flex items-center gap-3 px-2 mb-1">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: 'var(--primary)' }} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface border-2 flex items-center justify-center font-bold shadow-sm text-content" style={{ borderColor: 'var(--primary)' }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-semibold text-content block truncate leading-tight">{profile?.full_name || 'Minha Conta'}</span>
            <span className="text-[10px] text-muted block truncate leading-tight mt-0.5">{user?.email}</span>
          </div>
        </div>

        {/* Global Control Row */}
        <div className="flex items-center justify-between gap-1.5 bg-background/50 p-1.5 rounded-xl border border-border">
          <button 
            onClick={() => setShowBalances(!showBalances)}
            className="flex flex-1 items-center justify-center p-2 text-muted hover:text-content transition-all rounded-lg hover:bg-surface"
            title={showBalances ? "Ocultar Valores" : "Mostrar Valores"}
          >
            {showBalances ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          
          <div className="w-px h-6 bg-border mx-1"></div>

          <button 
            onClick={() => signOut()}
            className="flex flex-1 items-center justify-center p-2 text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all rounded-lg"
            title="Sair do FinControl"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
