import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { name: 'Painel', path: '/dashboard', icon: Home },
    { name: 'Rendas', path: '/incomes', icon: DollarSign },
    { name: 'Despesas', path: '/expenses', icon: CreditCard },
    { name: 'Config', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 z-50 flex justify-around items-center px-2 py-1 safe-area-pb">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname.startsWith(item.path);
        
        return (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all w-16 h-14",
              isActive 
                ? "text-emerald-400" 
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Icon size={isActive ? 22 : 20} className={cn("transition-all", isActive && "stroke-emerald-400")} />
            <span className={cn("text-[10px] font-medium transition-all", isActive && "opacity-100 font-bold")}>
              {item.name}
            </span>
            {isActive && <div className="absolute top-1 w-8 h-8 bg-emerald-500/10 rounded-full -z-10 blur-sm"></div>}
          </Link>
        );
      })}
    </nav>
  );
}
