import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, Settings as SettingsIcon, Target, PieChart, LineChart, FileDown, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export default function BottomNav() {
  const location = useLocation();
  const { activeGroupId, userGroups } = useAuth();
  
  const activeGroup = userGroups.find(g => g.id === activeGroupId);
  
  const navItems = [
    { name: 'Home', path: '/dashboard', icon: Home },
    { name: 'Rendas', path: '/incomes', icon: DollarSign },
    { name: 'Despesas', path: '/expenses', icon: CreditCard },
    { name: 'Cards', path: '/cards', icon: CreditCard },
    { name: 'Metas', path: '/goals', icon: Target },
    { name: 'Relatórios', path: '/reports', icon: PieChart },
    { name: 'Balanço', path: '/net-worth', icon: LineChart },
    { name: 'Exportar', path: '/export', icon: FileDown },
    { name: 'Config', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border z-50 flex flex-col items-center safe-area-pb">
      {/* Workspace Indicator Mobile */}
      {activeGroup && (
        <div className="w-full flex justify-center mt-1 -mb-1 px-4">
          <div className="bg-primary/10 border border-primary/20 px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm max-w-full">
            <Users size={10} className="text-primary" />
            <span className="text-[9px] font-extrabold text-primary truncate uppercase tracking-tighter">
              {activeGroup.nome}
            </span>
          </div>
        </div>
      )}

      <div className="flex overflow-x-auto scrollbar-none snap-x items-center px-2 py-1 h-16 w-full justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
               "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all w-16 h-14 snap-start flex-shrink-0 relative",
                isActive 
                  ? "text-primary-glow" 
                  : "text-muted hover:text-muted"
              )}
            >
              <Icon size={isActive ? 22 : 20} className={cn("transition-all", isActive && "stroke-primary-glow")} />
              <span className={cn("text-[10px] font-medium transition-all", isActive && "opacity-100 font-bold")}>
                {item.name}
              </span>
              {isActive && <div className="absolute top-1 w-8 h-8 bg-primary/10 rounded-full -z-10 blur-sm"></div>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
