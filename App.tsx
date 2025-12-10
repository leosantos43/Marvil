
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';

import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Chat from './pages/Chat';
import Checklists from './pages/Checklists';
import Team from './pages/Team';
import TechnicalTeam from './pages/TechnicalTeam';
import SettingsPage from './pages/Settings';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center bg-background text-primary">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

// Main Layout Component
const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Determine title based on route (simple mapping for mobile header)
  const getPageTitle = () => {
    switch (true) {
      case location.pathname === '/': return 'Visão Geral';
      case location.pathname === '/obras': return 'Obras';
      case location.pathname.startsWith('/obras/'): return 'Detalhes da Obra';
      case location.pathname === '/chat': return 'Chat';
      case location.pathname === '/checklists': return 'Checklists';
      case location.pathname === '/equipe': return 'Equipe';
      case location.pathname === '/responsaveis': return 'Responsáveis Técnicos';
      case location.pathname === '/config': return 'Configurações';
      default: return 'Elétrica Marvil';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-secondary border-b border-gray-800 z-10 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold text-white">{getPageTitle()}</h1>
          <div className="w-8"></div> {/* Spacer for alignment */}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth flex flex-col">
            <div className="flex-1">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/obras" element={<Projects />} />
                    <Route path="/obras/:id" element={<ProjectDetails />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/checklists" element={<Checklists />} />
                    <Route path="/equipe" element={<Team />} />
                    <Route path="/responsaveis" element={<TechnicalTeam />} />
                    <Route path="/config" element={<SettingsPage />} />
                    {/* Fallback routes for demo */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>

            {/* Global Footer */}
            <footer className="mt-8 pt-6 pb-2 border-t border-gray-800 text-center">
                <p className="text-xs text-gray-500">
                    Sistema desenvolvido pela{' '}
                    <a 
                        href="https://www.tisemfronteira.com.br" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary hover:text-orange-400 font-bold transition-colors"
                    >
                        TI SEM FRONTEIRA
                    </a>
                </p>
            </footer>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
