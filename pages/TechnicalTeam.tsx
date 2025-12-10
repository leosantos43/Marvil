
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, HardHat, PenTool, Search, Info, Loader2, AlertTriangle } from 'lucide-react';
import { supabase, generateUUID } from '../services/supabase';
import { User } from '../types';
import MobileCardTable, { Column } from '../components/MobileCardTable';
import Modal from '../components/Modal';

const TechnicalTeam = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', email: '', role: 'engenheiro'
  });
  const [filter, setFilter] = useState('');
  
  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 1. Fetch Users Real Implementation
  const fetchUsers = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['engenheiro', 'arquiteto']);
        
        if (error) throw error;
        setUsers(data || []);
    } catch (err: any) {
        console.error('Erro ao buscar responsáveis:', err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter for Technical Roles only (Engenheiro / Arquiteto)
  const technicalUsers = useMemo(() => {
    return users.filter(u => 
      ['engenheiro', 'arquiteto'].includes(u.role) &&
      (u.name.toLowerCase().includes(filter.toLowerCase()) || (u.email || '').toLowerCase().includes(filter.toLowerCase()))
    );
  }, [users, filter]);

  const requestDelete = (id: string) => {
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
        alert('Responsável removido com sucesso.');
    } catch (error: any) {
        console.error('Erro ao excluir:', error);
        
        const errCode = error?.code;
        const errMsg = error?.message || '';

        // Tratamento de Foreign Key Constraint (FK)
        if (errCode === '23503' || errMsg.includes('violates foreign key')) {
            alert("Não foi possível excluir: Este profissional é responsável por obras ativas.\n\nSOLUÇÃO: Vá em 'Configurações' > 'Reparo de Banco de Dados' e copie o script de correção para rodar no Supabase.");
        } else {
            // Safe error extraction
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
        role: 'engenheiro'
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return; 

    // Generate ID in frontend to ensure Insert works even if DB default is missing
    const newId = generateUUID();

    const payload = {
        id: newId,
        name: formData.name,
        // Convert empty email string to NULL to avoid Unique constraint violation
        email: formData.email && formData.email.trim() !== '' ? formData.email : null,
        role: formData.role || 'engenheiro'
    };
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .insert(payload)
            .select();
        
        if (error) throw error;

        if (data) {
            setUsers(prev => [...prev, data[0] as User]);
            setIsModalOpen(false);
        }
    } catch (err: any) {
        console.error('Erro ao salvar:', err);
        const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : 'Erro desconhecido');
        alert(`Erro ao salvar responsável: ${msg}`);
    }
  };

  const columns: Column<User>[] = [
    { header: 'Nome', accessor: (u) => (
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${u.role === 'engenheiro' ? 'bg-blue-600' : 'bg-pink-600'}`}>
                {u.name.charAt(0)}
            </div>
            <div>
                <p className="font-bold text-white text-base">{u.name}</p>
                <p className="text-sm text-gray-500">{u.email || 'Sem e-mail (Controle Interno)'}</p>
            </div>
        </div>
    )},
    { header: 'Cargo', accessor: (u) => (
        u.role === 'engenheiro' ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-blue-400 bg-blue-400/10 text-blue-400 w-fit">
                <HardHat size={14} /> Engenheiro
            </div>
        ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-pink-400 bg-pink-400/10 text-pink-400 w-fit">
                <PenTool size={14} /> Arquiteto
            </div>
        )
    )},
    { header: 'Ações', accessor: (u) => (
        <div className="flex justify-end">
            {deletingId === u.id ? (
                <Loader2 className="animate-spin text-red-400" size={20} />
            ) : (
                <button 
                    onClick={() => requestDelete(u.id)} 
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Excluir Responsável"
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
            <h1 className="text-2xl font-bold text-white">Responsáveis Técnicos</h1>
            <p className="text-gray-400 text-sm">Cadastre aqui os profissionais que aparecerão na criação de Obras.</p>
        </div>
        
        <button 
            onClick={handleOpenModal}
            className="bg-primary hover:bg-orange-600 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
            <Plus size={20} />
            <span className="md:inline">Novo Responsável</span>
        </button>
      </div>

      <div className="bg-secondary p-4 rounded-xl border border-gray-800 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
            <input 
                type="text"
                placeholder="Buscar por nome ou email..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 p-2.5 text-white focus:border-primary focus:outline-none"
            />
          </div>
      </div>

      <div className="flex-1">
        {loading ? (
             <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-primary" size={32} />
             </div>
        ) : (
            <MobileCardTable 
                data={technicalUsers}
                columns={columns}
                keyExtractor={u => u.id}
                emptyMessage="Nenhum responsável técnico cadastrado."
            />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Excluir Responsável"
        maxWidth="sm"
      >
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Remover Profissional?</h3>
              <p className="text-sm text-gray-400 mb-6">
                  Se este profissional já estiver vinculado a obras, a exclusão poderá ser bloqueada.
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Responsável Técnico">
        <form onSubmit={handleSave} className="space-y-5">
            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Nome Completo *</label>
                <input required type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Dr. Roberto Campos" />
            </div>
            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">E-mail (Opcional)</label>
                <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Sem email de acesso" />
            </div>
            <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Tipo de Profissional</label>
                <div className="grid grid-cols-2 gap-4">
                    <label className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center justify-center transition-all ${formData.role === 'engenheiro' ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                        <input type="radio" name="role" className="hidden" 
                            checked={formData.role === 'engenheiro'} 
                            onChange={() => setFormData({...formData, role: 'engenheiro'})} 
                        />
                        <HardHat size={24} className="mb-2" />
                        <span className="font-bold text-sm">Engenheiro</span>
                    </label>

                    <label className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center justify-center transition-all ${formData.role === 'arquiteto' ? 'bg-pink-500/20 border-pink-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                        <input type="radio" name="role" className="hidden" 
                            checked={formData.role === 'arquiteto'} 
                            onChange={() => setFormData({...formData, role: 'arquiteto'})} 
                        />
                        <PenTool size={24} className="mb-2" />
                        <span className="font-bold text-sm">Arquiteto</span>
                    </label>
                </div>
            </div>
            
            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20 flex items-start gap-3">
                <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-200 text-xs">
                    <strong>Fonte de Dados:</strong> Ao cadastrar aqui, este profissional aparecerá automaticamente na lista de seleção de "Responsável Técnico" ao criar uma nova obra.
                </p>
            </div>

            <button type="submit" className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                Salvar Responsável
            </button>
        </form>
      </Modal>
    </div>
  );
};

export default TechnicalTeam;
