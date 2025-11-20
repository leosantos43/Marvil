
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Zap, Eye, EyeOff, ShieldAlert } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegisteringAdmin, setIsRegisteringAdmin] = useState(false);
  
  const { setSession, setProfile } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 🚀 CRITICAL FIX: Update state IMMEDIATELY to prevent double login/race conditions
      if (data.session) {
        setSession(data.session);
        // Optimistically fetch profile or let AuthWrapper handle it, but ensure we navigate
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
      setLoading(false);
    }
  };

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            is_admin_setup: 'true' // This flag triggers the SQL function to set role='admin'
          }
        }
      });

      if (authError) throw authError;

      alert('Conta Admin criada com sucesso! O login será realizado automaticamente.');
      
      if (data.session) {
        setSession(data.session);
        navigate('/');
      } else {
        // If email confirmation is enabled (unlikely in this setup but possible)
        alert('Verifique seu e-mail para confirmar a conta.');
        setIsRegisteringAdmin(false);
      }

    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background abstract shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-marvil-orange/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md p-8 bg-marvil-card border border-marvil-border rounded-lg shadow-2xl relative z-10 backdrop-blur-md">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-marvil-orange/20 rounded-full flex items-center justify-center border border-marvil-orange/50 shadow-glow">
            <Zap size={32} className="text-marvil-orange" />
          </div>
        </div>

        <h2 className="text-3xl font-display font-bold text-center text-white mb-2">ELÉTRICA <span className="text-marvil-orange">MARVIL</span></h2>
        <p className="text-center text-gray-500 mb-8 font-mono text-sm">
          {isRegisteringAdmin ? 'SETUP INICIAL: CRIAR ADMIN' : 'ACESSO AO SISTEMA DE GESTÃO'}
        </p>

        <form onSubmit={isRegisteringAdmin ? handleRegisterAdmin : handleLogin} className="space-y-6">
          
          {isRegisteringAdmin && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded text-xs text-yellow-500 flex items-start gap-2">
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span>Atenção: Esta funcionalidade é apenas para a criação do primeiro acesso. Utilize com responsabilidade.</span>
            </div>
          )}

          {isRegisteringAdmin && (
            <Input
              type="text"
              label="Nome Completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: João Silva"
              required
            />
          )}

          <Input
            type="email"
            label="E-mail Corporativo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
          
          <Input
            type={showPassword ? "text" : "password"}
            label="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            endAdornment={
              <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="focus:outline-none">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full py-3 shadow-glow" isLoading={loading}>
            {isRegisteringAdmin ? 'CRIAR CONTA ADMIN' : 'ENTRAR NO SISTEMA'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button 
            type="button"
            onClick={() => {
              setIsRegisteringAdmin(!isRegisteringAdmin);
              setError('');
              setFullName('');
            }}
            className="text-xs text-marvil-orange hover:text-white transition-colors underline decoration-dotted"
          >
            {isRegisteringAdmin ? 'Voltar para Login' : 'Primeiro acesso? Criar Admin Temporário'}
          </button>
          
          {!isRegisteringAdmin && (
             <div className="text-xs text-gray-600">
                Esqueceu sua senha? Contate o administrador.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
