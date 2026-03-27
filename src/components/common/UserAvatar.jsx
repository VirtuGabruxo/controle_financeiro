import React from 'react';
import { cn } from '../../lib/utils';

/**
 * UserAvatar - Componente de identidade visual consistente.
 * @param {string} nameOrEmail - Nome completo ou email do usuário.
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} className - Classes adicionais de estilização.
 */
export default function UserAvatar({ nameOrEmail, size = 'md', className }) {
  if (!nameOrEmail) return null;

  // 1. Extração Inteligente de Iniciais (Até 2 letras)
  const getInitials = (val) => {
    const clean = val.trim().toUpperCase();
    
    // Se for email, pega a parte antes do @
    const userPart = clean.includes('@') ? clean.split('@')[0] : clean;
    
    // Se tiver espaços (Nome Completo) ou separadores
    const parts = userPart.split(/[\s._-]+/).filter(p => !['@', '.', '-'].includes(p) && p.length > 0);
    
    if (parts.length >= 2) {
      // Primeiro e último nome 
      return (parts[0][0] + parts[parts.length - 1][0]).substring(0, 2);
    }
    
    if (userPart.length >= 2) return userPart.substring(0, 2);
    return userPart[0] || '?';
  };

  // 2. Cor Determinística baseada em Hash
  const getDeterministicColor = (str) => {
    const colors = [
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-violet-600 text-white',
      'bg-rose-600 text-white',
      'bg-amber-600 text-white',
      'bg-indigo-600 text-white',
      'bg-cyan-600 text-white',
    ];
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        // Simple hash sum
        hash += str.charCodeAt(i);
    }
    
    const index = hash % colors.length;
    return colors[index];
  };

  const initials = getInitials(nameOrEmail);
  const colorClass = getDeterministicColor(nameOrEmail);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-base shadow-lg shadow-black/20',
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-center rounded-full font-bold shrink-0 transition-transform active:scale-95 select-none",
        sizeClasses[size] || sizeClasses.md,
        colorClass,
        className
      )}
      title={nameOrEmail}
    >
      {initials}
    </div>
  );
}
