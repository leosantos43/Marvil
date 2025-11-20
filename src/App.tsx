import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProjectList } from './pages/ProjectList';
import { ProjectDetail } from './pages/ProjectDetail';
import { Users } from './pages/Users';
import { ChatApp } from './pages/ChatApp';
import { Clients } from './pages/Clients';
import { Logs } from './pages/Logs';
import { AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import ProfilePage from './pages/Profile';
import ReportsPage from './pages/Reports';
import ProtectedRoute from "./components/ProtectedRoute";


// ---------------------------
// AUTH WRAPPER
// ---------------------------
const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading, setSession, setProfile, setLoading } = useAuthStore();
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (useAuthStore.getState().loading) {
        setLoading(false); 
      }
    }, 6000);

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        setSession(session);
        if (session) {
          await fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setSession(session);
      if (session) {
        setProfileError(false);
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const fetchPromise = supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) throw error;

      setProfile(data);
    } catch (error) {
      setProfileError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="animate-spin w-12 h-12 rounded-full border-4 border-t-marvil-orange"></div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (profileError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
        <AlertTriangle size={40} className="text-red-500 mb-3" />
        <h2 className="text-xl font-bold mb-2">Falha ao carregar perfil</h2>
        <p className="text-gray-400 mb-4">Ocorreu um erro ao tentar recuperar seu perfil.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-marvil-orange rounded font-bold"
        >
          Recarregar
        </button>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
};


// ---------------------------
// APP ROUTES
// ---------------------------
const App: React.FC = () => {
  return (
    <Router>
      <Routes>

        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* ROTAS AUTENTICADAS */}
        <Route
          path="/"
          element={
            <AuthWrapper>
              <Dashboard />
            </AuthWrapper>
          }
        />

        <Route
          path="/projects"
          element={
            <AuthWrapper>
              <ProjectList />
            </AuthWrapper>
          }
        />

        <Route
          path="/projects/:id"
          element={
            <AuthWrapper>
              <ProjectDetail />
            </AuthWrapper>
          }
        />

        <Route
          path="/clients"
          element={
            <AuthWrapper>
              <Clients />
            </AuthWrapper>
          }
        />

        <Route
          path="/users"
          element={
            <AuthWrapper>
              <Users />
            </AuthWrapper>
          }
        />

        <Route
          path="/chat"
          element={
            <AuthWrapper>
              <ChatApp />
            </AuthWrapper>
          }
        />

        <Route
          path="/logs"
          element={
            <AuthWrapper>
              <Logs />
            </AuthWrapper>
          }
        />

        {/* NOVAS PÁGINAS */}
        <Route
          path="/perfil"
          element={
            <AuthWrapper>
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            </AuthWrapper>
          }
        />

        <Route
          path="/relatorios"
          element={
            <AuthWrapper>
              <ProtectedRoute adminOnly>
                <ReportsPage />
              </ProtectedRoute>
            </AuthWrapper>
          }
        />

        {/* ROTA PADRÃO */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Router>
  );
};

export default App;
