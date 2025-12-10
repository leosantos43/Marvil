
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  HardHat, 
  CheckSquare, 
  MessageSquare, 
  Users, 
  Settings, 
  LogOut,
  X,
  Zap,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, signOut, unreadCount } = useAuth();
  const location = useLocation();
  
  // Ler nome da empresa salvo nas configurações
  const companyName = localStorage.getItem('companyName') || 'Elétrica Marvil';

  const getLinks = (role: UserRole) => {
    const common = [
      { to: '/', icon: LayoutDashboard, label: 'Visão Geral' },
      { to: '/obras', icon: HardHat, label: 'Obras' },
      { to: '/chat', icon: MessageSquare, label: 'Chat', badge: unreadCount }, // Adicionado badge
      { to: '/checklists', icon: CheckSquare, label: 'Checklists' },
      { to: '/config', icon: Settings, label: 'Configurações' }, // Movido para área comum para todos acessarem troca de senha
    ];

    if (role === 'admin') {
      return [
        ...common,
        { to: '/equipe', icon: Users, label: 'Equipe Operacional' },
        { to: '/responsaveis', icon: UserCheck, label: 'Responsáveis' },
      ];
    }
    
    return common;
  };

  const links = user ? getLinks(user.role) : [];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-secondary border-r border-gray-800 
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:block
        `}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-2 text-primary">
            <Zap size={28} fill="currentColor" />
            <span className="text-xl font-bold tracking-tight text-white truncate">{companyName}</span>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col justify-between h-[calc(100%-80px)] p-4">
          <nav className="space-y-2">
            {links.map((link) => {
              const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => window.innerWidth < 768 && onClose()}
                  className={`
                    flex items-center justify-between px-4 py-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-primary/10 text-primary border-l-4 border-primary' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <link.icon size={20} className="mr-3" />
                    <span className="font-medium">{link.label}</span>
                  </div>
                  {/* Badge de Mensagens */}
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center px-4 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {user?.name.charAt(0)}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={signOut}
              className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              <LogOut size={18} className="mr-3" />
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
