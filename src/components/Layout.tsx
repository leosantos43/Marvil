import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

import {
  LayoutDashboard,
  HardHat,
  Users,
  LogOut,
  Menu,
  ShieldCheck,
  Activity,
  MessageSquare,
  Briefcase,
  UserCircle,
  BarChart3,
} from 'lucide-react'

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    navigate('/login')
  }

  const isAdmin = profile?.role === 'admin'
  const isEmployee = profile?.role === 'funcionario'
  const isClient = profile?.role === 'cliente'

  const links = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      show: isAdmin || isEmployee,
    },
    {
      name: 'Obras',
      href: '/projects',
      icon: HardHat,
      show: true,
    },
    {
      name: 'Clientes',
      href: '/clients',
      icon: Briefcase,
      show: isAdmin,
    },
    {
      name: 'Chat Equipe',
      href: '/chat',
      icon: MessageSquare,
      show: isAdmin || isEmployee,
    },
    {
      name: 'Usuários',
      href: '/users',
      icon: Users,
      show: isAdmin,
    },
    {
      name: 'Relatórios',
      href: '/relatorios',
      icon: BarChart3,
      show: isAdmin,
    },
    {
      name: 'Logs',
      href: '/logs',
      icon: Activity,
      show: isAdmin,
    },
    {
      name: 'Meu Perfil',
      href: '/perfil',
      icon: UserCircle,
      show: true,
    },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white font-sans">

      {/* Overlay mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-marvil-dark border-r border-marvil-border shadow-xl
          transform transition-all duration-300 lg:relative lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-marvil-border flex items-center gap-3">
          <div className="w-9 h-9 bg-marvil-orange rounded flex items-center justify-center shadow-glow">
            <span className="font-bold text-white text-xl">M</span>
          </div>
          <span className="font-display font-bold text-lg tracking-widest">
            ELÉTRICA <span className="text-marvil-orange">MARVIL</span>
          </span>
        </div>

        {/* LINKS */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto styled-scrollbar">
          {links
            .filter((l) => l.show)
            .map((link) => {
              const isActive = location.pathname === link.href
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group
                    ${
                      isActive
                        ? 'bg-marvil-orange/15 text-marvil-orange border-l-2 border-marvil-orange'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <link.icon
                    size={20}
                    className={isActive ? 'text-marvil-orange shadow-glow' : ''}
                  />
                  <span className="font-medium tracking-wide">{link.name}</span>
                </Link>
              )
            })}
        </nav>

        {/* USER INFO */}
        <div className="p-4 border-t border-marvil-border bg-black/20">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center text-marvil-orange font-bold border border-marvil-border">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
              <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                {isAdmin && <ShieldCheck size={10} className="text-marvil-orange" />}
                {profile?.role}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="h-16 border-b border-marvil-border bg-marvil-dark/60 backdrop-blur flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white lg:hidden"
          >
            <Menu size={24} />
          </button>

          <div className="ml-auto text-xs text-gray-500 font-mono tracking-widest">
            SYSTEM V2.0 • ONLINE • REALTIME
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 styled-scrollbar">
          {children}
        </main>
      </div>
    </div>
  )
}
