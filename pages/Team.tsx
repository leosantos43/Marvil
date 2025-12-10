
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Shield, Briefcase, Zap, Lock, Loader2, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { User, UserRole } from '../types';
import MobileCardTable, { Column } from '../components/MobileCardTable';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const Team = () => {
  const { signUp, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', email: '', role: 'eletricista'
  });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch users from Supabase
  const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        setUsers(data || []);
      } catch (error: any) {
        console.error('Error fetching profiles:', error.message || error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
      fetchUsers();
  }, []);

  // Filter users to show only Operational, Admin, and Client roles
  const filteredUsers = useMemo(() => {
    return users.filter(u => ['admin', 'eletricista', 'cliente'].includes(u.role));
  }, [users]);

  const requestDelete = (id: string) => {
      if (id === currentUser?.id) {
        alert("Você não pode excluir seu próprio usuário.");
        return;
      }
      setUserToDelete(id);
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setDeletingId(userToDelete);
    try {
        const { error } = await supabase.from('profiles').delete().eq('id', userToDelete);
        
        if (error) throw error;
        
        setUsers(prev => prev.filter(u => u.id !== userToDelete));
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
        alert('Usuário removido com sucesso.');
    } catch (error: any) {
        console.error('Error deleting user:', error);
        
        const errCode = error?.code;
        const errMsg = error?.message || '';

        // Check for Foreign Key constraint errors (23503)
        if (errCode === '23503' || errMsg.includes('violates foreign key')) {
            alert("Não foi possível excluir: O usuário possui vínculos (Chat, Checklists, etc) que o banco de dados protege.\n\nSOLUÇÃO: Vá em 'Configurações' > 'Reparo de Banco de Dados' e copie o script de correção para rodar no Supabase.");
        } else {
            // Safe error message extraction
            let displayMsg = errMsg;
            if (!displayMsg) {
                 try {
                    displayMsg = JSON.stringify(error);
                 } catch (e) {
                    displayMsg = 'Erro desconhecido.';
                 }
            }
            alert(`Erro ao excluir: ${displayMsg}`);
        }
    } finally {
        setDeletingId(null);
    }
  };

  const handleOpenModal = () => {
    setFormData({
        name: '', 
        email: '', 
        role: 'eletricista'
    });
    setPassword('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !password) {
        alert("Preencha todos os campos obrigatórios");
        return;
    }

    setCreating(true);
    try {
        // We use signUp to create the Auth User
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: password,
            options: {
                data: {
                    name: formData.name,
                    role: formData.role
                }
            }
        });

        if (authError) throw authError;

        // Try to manually insert profile as fallback
        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    name: formData.name,
                    email: formData.email,
                    role: formData.role
                }, { onConflict: 'id' });
            
            if (profileError) {
                console.warn('Manual profile creation warning:', profileError);
            }
        }
        
        // Refresh list
        await fetchUsers();
        setIsModalOpen(false);
        
        // Verifica se a sessão foi criada ou se aguarda confirmação
        if (authData.user && !authData.session) {
            alert('Usuário criado! OBS: Um e-mail de confirmação foi enviado. O usuário só conseguirá logar após confirmar o e-mail (caso o Supabase esteja configurado para isso).');
        } else {
            alert('Usuário criado com sucesso!');
        }
        
    } catch (error: any) {
        console.error('Error creating user:', error);
        
        let msg = 'Erro desconhecido';
        if (typeof error === 'string') msg = error;
        else if (error?.message) msg = error.message;
        else if (typeof error === 'object') msg = JSON.stringify(error);

        // Handle specific Supabase error for duplicates
        if (msg.includes("already registered") || msg.includes("User already registered")) {
            alert("Este e-mail já está cadastrado no sistema.");
        } else {
            alert(`Erro ao criar usuário: ${msg}`);
        }
    } finally {
        setCreating(false);
    }
  };

  const roleConfig: Record<string, { label: string, icon: any, color: string }> = {
    admin: { label: 'Administrador', icon: Shield, color: 'text-purple-400 border-purple-400' },
    eletricista: { label: 'Eletricista', icon: Zap, color: 'text-yellow-400 border-yellow-400' },
    cliente: { label: 'Cliente', icon: Briefcase, color: 'text-green-400 border-green-400' }
  };

  const columns: Column<User>[] = [
    { header: 'Nome', accessor: (u) => (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-lg">
                {u.name.charAt(0)}
            </div>
            <div>
                <p className="font-bold text-white text-base">{u.name}</p>
                <p className="text-sm text-gray-500">{u.email || 'Sem e-mail'}</p>
            </div>
        </div>
    )},
    { header: 'Função', accessor: (u) => {
        const config = roleConfig[u.role] || roleConfig.eletricista;
        const Icon = config.icon;
        return (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border w-fit ${config.color.replace('text-', 'bg-').replace('400', '400/10')} ${config.color}`}>
                <Icon size={14} />
                {config.label}
            </div>
        );
    }},
    { header: 'Ações', accessor: (u) => (
        <div className="flex justify-end">
            {deletingId === u.id ? (
                <Loader2 className="animate-spin text-red-400" size={20} />
            ) : (
                <button 
                    onClick={() => requestDelete(u.id)} 
                    disabled={u.id === currentUser?.id}
                    className={`p-2 rounded-lg transition-colors ${u.id === currentUser?.id ? 'text-gray-600 cursor-not-allowed' : 'text-red-400 hover:bg-red-400/10'}`}
                    title="Excluir Usuário"
                >
                    <Trash2 size={20} />
                </button>
            )}
        </div>
    ), className: 'text-right' }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
            <h1 className="text-2xl font-bold text-white">Equipe & Usuários</h1>
            <p className="text-gray-400 text-sm">Gerencie eletricistas, administradores e clientes.</p>
        </div>
        <button 
            onClick={handleOpenModal}
            className="bg-primary hover:bg-orange-600 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
            <Plus size={20} />
            <span className="md:inline">Adicionar Novo</span>
        </button>
      </div>

      <div className="flex-1">
        {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando equipe...</div>
        ) : (
            <MobileCardTable 
                data={filteredUsers}
                columns={columns}
                keyExtractor={u => u.id}
                emptyMessage="Nenhum usuário encontrado."
            />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Excluir Usuário"
        maxWidth="sm"
      >
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Remover Usuário?</h3>
              <p className="text-sm text-gray-400 mb-6">
                  Esta ação é irreversível. Se o usuário tiver vínculos (histórico), a exclusão pode ser bloqueada.
              </p>
              <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Excluir
                  </button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastrar Usuário">
        <form onSubmit={handleSave} className="space-y-5">
            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Nome Completo *</label>
                <input required type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Maria Silva" />
            </div>
            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">E-mail (Login) *</label>
                <input required type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" />
            </div>
            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Senha *</label>
                <div className="relative">
                    <input required type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-primary focus:outline-none" 
                        value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
                     <Lock className="absolute left-3 top-3.5 text-gray-500" size={18} />
                </div>
            </div>

            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Função / Cargo</label>
                <div className="relative">
                    <select className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none appearance-none"
                        value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                        <option value="eletricista">⚡ Eletricista</option>
                        <option value="admin">🛡️ Administrador</option>
                        <option value="cliente">💼 Cliente</option>
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">▼</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    * Para gerenciar Engenheiros e Arquitetos, utilize o menu <strong>Responsáveis</strong>.
                </p>
            </div>
            
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                <div className="flex items-start gap-2 mb-1">
                    <Info size={16} className="text-blue-400 mt-0.5" />
                    <p className="text-white font-medium text-sm">Atenção ao E-mail</p>
                </div>
                <p className="text-gray-400 text-xs">
                    Se o seu projeto Supabase tiver "Confirm Email" ativado, o usuário não conseguirá logar até clicar no link enviado por e-mail. Para login imediato, desative essa opção no painel do Supabase.
                </p>
            </div>

            <button type="submit" disabled={creating} className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50">
                {creating ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Criando...</span> : 'Cadastrar Usuário'}
            </button>
        </form>
      </Modal>
    </div>
  );
};

export default Team;
