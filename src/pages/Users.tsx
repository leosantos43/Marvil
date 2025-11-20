
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Profile } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, User, Shield, Ban, Check, Plus, Key, X } from 'lucide-react';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form States
  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'funcionario' });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('users_profiles').select('*').order('full_name');
    setUsers(data || []);
    setLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    // Using standard client because Admin has RLS permission to update profiles
    await supabase.from('users_profiles').update({ active: !currentStatus }).eq('id', id);
    fetchUsers();
  };

  const updateRole = async (id: string, newRole: string) => {
    // Using standard client because Admin has RLS permission to update profiles
    await supabase.from('users_profiles').update({ role: newRole }).eq('id', id);
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      // Create a temporary client to avoid logging out the admin
      // We use the same public URL and Key
      // Note: The new user will be created, but 'auto-confirm' needs to be ON in Supabase settings
      // Or we rely on the session not being persisted for this temp client instance
      const tempClient = createClient(
        'https://xvzodsnsjwzdacrdzcdk.supabase.co', 
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2em9kc25zand6ZGFjcmR6Y2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODczNzgsImV4cCI6MjA3OTE2MzM3OH0.djiBMmmauzJpbMto_UvAoSA2o4-Q9Cpjf84yLmPUkYs',
        {
          auth: {
            persistSession: false // CRITICAL: Do not overwrite Admin session
          }
        }
      );

      const { data, error } = await tempClient.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.fullName,
            is_admin_setup: newUser.role === 'admin' ? 'true' : 'false'
          }
        }
      });

      if (error) throw error;

      // Trigger handles profile creation, but we can ensure it here with Admin privs
      if (data.user) {
         // Small delay for trigger
         await new Promise(r => setTimeout(r, 1000));
         
         // Enforce profile data (Admin has RLS to upsert)
         await supabase.from('users_profiles').upsert({ 
            id: data.user.id,
            email: newUser.email,
            role: newUser.role as any,
            full_name: newUser.fullName,
            active: true
         });
      }

      alert('Usuário criado com sucesso!');
      setIsCreateOpen(false);
      setNewUser({ email: '', password: '', fullName: '', role: 'funcionario' });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('already registered') || err.code === 'user_already_exists') {
         alert('Erro: Este e-mail já está cadastrado no sistema.');
      } else {
         alert('Erro ao criar usuário: ' + (err.message || err));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      // Calls the secure Database Function (RPC)
      const { error } = await supabase.rpc('admin_reset_password', {
        target_user_id: selectedUser.id,
        new_password: newPassword
      });

      if (error) throw error;

      alert(`Senha de ${selectedUser.full_name} atualizada com sucesso!`);
      setIsResetOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err: any) {
      alert('Erro ao redefinir senha: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Gestão de Usuários</h1>
          <p className="text-gray-400">Administre o acesso e senhas do sistema</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="shadow-glow">
          <Plus size={18} className="mr-2" /> Novo Usuário
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
        <Input 
          className="pl-10" 
          placeholder="Buscar usuários..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-marvil-card border border-marvil-border rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-marvil-dark text-gray-400 uppercase font-mono">
            <tr>
              <th className="p-4">Usuário</th>
              <th className="p-4">Contato</th>
              <th className="p-4">Função</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-marvil-border">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Carregando...</td></tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-marvil-orange font-bold border border-marvil-border">
                      {user.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-gray-400">{user.phone || '-'}</td>
                <td className="p-4">
                  <select 
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    className="bg-black border border-marvil-border rounded px-2 py-1 text-xs text-white focus:border-marvil-orange outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="funcionario">Funcionário</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.active ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-4 flex justify-center gap-2">
                   <button 
                     onClick={() => { setSelectedUser(user); setIsResetOpen(true); }}
                     className="p-1.5 bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500 hover:text-white transition-colors"
                     title="Alterar Senha"
                   >
                     <Key size={16} />
                   </button>
                   <button 
                     onClick={() => toggleStatus(user.id, user.active)}
                     className={`p-1.5 rounded transition-colors ${user.active ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white'}`}
                     title={user.active ? "Desativar" : "Ativar"}
                   >
                     {user.active ? <Ban size={16} /> : <Check size={16} />}
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Criar Usuário */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-marvil-card border border-marvil-border rounded-lg w-full max-w-md p-6">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Criar Novo Usuário</h2>
                <button onClick={() => setIsCreateOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
             </div>
             <form onSubmit={handleCreateUser} className="space-y-4">
                <Input label="Nome Completo" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} required />
                <Input label="E-mail" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                <Input label="Senha Inicial" type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required minLength={6} />
                
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Função</label>
                  <select 
                    className="w-full bg-marvil-dark border border-marvil-border rounded px-4 py-2.5 text-white focus:border-marvil-orange outline-none"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="funcionario">Funcionário</option>
                    <option value="admin">Administrador</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </div>

                <Button type="submit" className="w-full mt-4" isLoading={actionLoading}>Criar Usuário</Button>
             </form>
          </div>
        </div>
      )}

      {/* Modal Resetar Senha */}
      {isResetOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-marvil-card border border-marvil-border rounded-lg w-full max-w-sm p-6">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Alterar Senha</h2>
                <button onClick={() => { setIsResetOpen(false); setSelectedUser(null); }} className="text-gray-500 hover:text-white"><X size={20}/></button>
             </div>
             <p className="text-sm text-gray-400 mb-4">
               Defina a nova senha para <strong>{selectedUser.full_name}</strong>. A alteração é imediata.
             </p>
             <form onSubmit={handleResetPassword} className="space-y-4">
                <Input 
                  label="Nova Senha" 
                  type="text" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  minLength={6} 
                  placeholder="Mínimo 6 caracteres"
                />
                <Button type="submit" className="w-full mt-2" isLoading={actionLoading}>Atualizar Senha</Button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
