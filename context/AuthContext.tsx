import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { User, UserRole, ChatMessage } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Ref para o temporizador de inatividade
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY_LIMIT = 60 * 1000; // 1 minuto em milissegundos

  // Função auxiliar para buscar o perfil atualizado do banco
  const fetchProfile = async (userId: string, email: string, metadataName?: string, metadataRole?: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        return {
          name: metadataName || 'Usuário',
          role: (metadataRole as UserRole) || 'cliente'
        };
      }

      return {
        name: profile.name,
        role: profile.role as UserRole
      };
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
      return { name: metadataName || 'Usuário', role: 'cliente' as UserRole };
    }
  };

  const fetchUnreadCount = async (userId: string) => {
      try {
          const { count, error } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', userId)
            .is('read_at', null);
          
          if (!error) {
              setUnreadCount(count || 0);
          }
      } catch (error) {
          console.error("Error fetching unread count", error);
      }
  };

  // Lógica de Logout
  const signOut = async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setUser(null);
    setUnreadCount(0);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  };

  // Monitoramento de Inatividade
  const resetInactivityTimer = useCallback(() => {
    if (!user) return;

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      // Ação quando o tempo expira
      signOut();
      alert("Sessão encerrada por inatividade (1 minuto).");
    }, INACTIVITY_LIMIT);
  }, [user, INACTIVITY_LIMIT]);

  useEffect(() => {
    // Se não tem usuário logado, não precisa monitorar
    if (!user) {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        return;
    }

    // Inicia o timer assim que o usuário é detectado
    resetInactivityTimer();

    // Eventos que consideram o usuário "ativo"
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
        resetInactivityTimer();
    };

    // Adiciona listeners
    events.forEach(event => {
        window.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        events.forEach(event => {
            window.removeEventListener(event, handleActivity);
        });
    };
  }, [user, resetInactivityTimer]);


  useEffect(() => {
    const initSession = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const profileData = await fetchProfile(
          session.user.id, 
          session.user.email!, 
          session.user.user_metadata.name,
          session.user.user_metadata.role
        );

        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: profileData.name,
          role: profileData.role
        });

        // Buscar contagem inicial
        fetchUnreadCount(session.user.id);
      }
      
      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
           const profileData = await fetchProfile(
            session.user.id, 
            session.user.email!, 
            session.user.user_metadata.name,
            session.user.user_metadata.role
          );
          
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: profileData.name,
            role: profileData.role
          });
          fetchUnreadCount(session.user.id);
        } else {
          setUser(null);
          setUnreadCount(0);
        }
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    };

    initSession();
  }, []);

  // Realtime Global Notification Listener
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel('global_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload) => {
        
        // Em qualquer alteração relevante para mim, recarregamos a contagem oficial do banco
        // Isso garante precisão em vez de depender de lógica incremental sujeita a erros
        if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            if (newMsg.recipient_id === user.id) {
                 fetchUnreadCount(user.id);
            }
        } else if (payload.eventType === 'UPDATE') {
             const newMsg = payload.new as ChatMessage;
             if (newMsg.recipient_id === user.id) {
                 fetchUnreadCount(user.id);
             }
        }
      })
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        throw new Error('Backend não configurado.');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, role }
          }
        });
        
        if (error) throw error;
        if (data.user && !data.session) {
            throw new Error('Cadastro realizado! Verifique seu email para confirmar.');
        }
      } else {
         throw new Error('Cadastro indisponível.');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUnreadCount = async () => {
      if (user) await fetchUnreadCount(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, unreadCount, refreshUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};