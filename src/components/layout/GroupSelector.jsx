import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Users, ChevronDown, Check } from 'lucide-react';

export default function GroupSelector() {
  const { userGroups, activeGroupId, setActiveGroupId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeGroup = userGroups.find(g => g.id === activeGroupId) || userGroups[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!userGroups || userGroups.length === 0) return null;

  return (
    <div className="relative px-4 mb-6" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {activeGroup?.nome?.toLowerCase().includes('pessoal') ? (
              <User size={20} />
            ) : (
              <Users size={20} />
            )}
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-xs text-muted font-medium truncate uppercase tracking-wider">Espaço Ativo</p>
            <p className="text-sm font-semibold text-content truncate">{activeGroup?.nome || 'Selecionar...'}</p>
          </div>
        </div>
        <ChevronDown 
          size={18} 
          className={`text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute left-4 right-4 mt-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-700/50 mb-1">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Meus Workspaces</p>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {userGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  setActiveGroupId(group.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${
                  activeGroupId === group.id ? 'bg-zinc-50 dark:bg-zinc-700/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                    activeGroupId === group.id ? 'bg-primary text-white' : 'bg-zinc-100 dark:bg-zinc-700 text-muted'
                  }`}>
                    {group.nome?.toLowerCase().includes('pessoal') ? (
                      <User size={16} />
                    ) : (
                      <Users size={16} />
                    )}
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${activeGroupId === group.id ? 'text-primary' : 'text-content'}`}>
                      {group.nome}
                    </p>
                    <p className="text-[10px] text-muted capitalize">{group.papel}</p>
                  </div>
                </div>
                {activeGroupId === group.id && (
                  <Check size={16} className="text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
