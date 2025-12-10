
import React, { useState, useEffect } from 'react';
import { Zap, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatically redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      // Explicit navigation in case useEffect is slightly delayed
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos.');
      } else if (err.message.includes('Email not confirmed')) {
          setError('E-mail não confirmado. Verifique sua caixa de entrada.');
      } else {
          setError(err.message || 'Falha na operação.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center animate-fade-in-down">
        <div className="inline-flex p-4 rounded-full bg-primary/20 mb-4">
          <Zap size={48} className="text-primary" fill="currentColor" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Elétrica Marvil</h1>
        <p className="text-gray-400">Sistema de Gestão de Obras</p>
      </div>

      <div className="w-full max-w-md bg-secondary rounded-2xl shadow-xl border border-gray-800 overflow-hidden">
        <div className="p-6 md:p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            Acesse sua conta
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center text-red-400 text-sm">
                <AlertCircle size={16} className="mr-2 shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-colors"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-gray-800/50 p-4 border-t border-gray-800">
          <div className="text-xs text-center text-gray-500 space-y-1">
            <p className="font-medium text-gray-400">Ambiente Seguro (Supabase Auth)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
