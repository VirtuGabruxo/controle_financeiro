import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, Settings as SettingsIcon, Target, PieChart, LineChart, FileDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { name: 'Painel', path: '/dashboard', icon: Home },
    { name: 'Rendas', path: '/incomes', icon: DollarSign },
    { name: 'Despesas', path: '/expenses', icon: CreditCard },
    { name: 'Cartões', path: '/cards', icon: CreditCard },
    { name: 'Metas', path: '/goals', icon: Target },
    { name: 'Relatórios', path: '/reports', icon: PieChart },
    { name: 'Balanço', path: '/net-worth', icon: LineChart },
    { name: 'Exportar', path: '/export', icon: FileDown },
    { name: 'Config', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border z-50 flex overflow-x-auto scrollbar-none snap-x items-center px-2 py-1 safe-area-pb w-full">
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
    </nav>
  );
}
