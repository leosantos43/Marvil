
import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Briefcase, User, Trash2, Edit2, HardHat, Loader2, RefreshCw, AlertCircle, Terminal, DollarSign, TrendingDown, TrendingUp, Wallet, AlertTriangle, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileCardTable, { Column } from '../components/MobileCardTable';
import Modal from '../components/Modal';
import { supabase } from '../services/supabase';
import { Project, ProjectStatus, User as AppUser, FinanceEntry } from '../types';
import { useAuth } from '../context/AuthContext';

// Interface estendida apenas para exibição na tabela com dados calculados
interface ProjectWithFinance extends Project {
  total_recebido?: number;
  total_gasto?: number;
  saldo_receber?: number;
}

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Diagnostics
  const [rlsError, setRlsError] = useState(false);
  
  // Data for Selects
  const [responsibleUsers, setResponsibleUsers] = useState<AppUser[]>([]);
  const [electricianUsers, setElectricianUsers] = useState<AppUser[]>([]);
  // Store all users for display purposes (Table lookup)
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);

  // Create/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Project>>({
    status: 'planejamento',
    progresso: 0,
    equipe_ids: [],
    valor_contrato: 0
  });

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setRlsError(false);
    try {
        let projectsData: any[] = [];
        let projectsError = null;

        // ESTRATÉGIA DIFERENCIADA POR PERFIL
        if (user?.role === 'eletricista') {
            try {
                const { data: myTeams, error: teamErr } = await supabase
                    .from('project_team')
                    .select('project_id')
                    .eq('user_id', user.id);

                if (teamErr) {
                    if (teamErr.message?.includes('infinite recursion') || teamErr.code === '42P17') {
                        console.error('ERRO CRÍTICO DB: Recursão infinita na tabela project_team. Execute o script de correção SQL.');
                        projectsData = [];
                    } else {
                        throw teamErr;
                    }
                } else if (myTeams && myTeams.length > 0) {
                    const myProjectIds = myTeams.map(t => t.project_id);
                    const result = await supabase
                        .from('projects')
                        .select('*')
                        .in('id', myProjectIds)
                        .order('created_at', { ascending: false });
                    
                    projectsData = result.data || [];
                    projectsError = result.error;

                    if (myTeams.length > 0 && projectsData.length === 0) {
                        setRlsError(true);
                    }
                } else {
                    projectsData = [];
                }
            } catch (err) {
                console.error('Erro ao buscar equipe do eletricista:', err);
                projectsData = [];
            }

        } else if (user?.role === 'engenheiro' || user?.role === 'arquiteto') {
            const result = await supabase
                .from('projects')
                .select('*')
                .eq('responsavel_id', user.id)
                .order('created_at', { ascending: false });
            
            projectsData = result.data || [];
            projectsError = result.error;
        } else if (user?.role === 'cliente') {
             const result = await supabase
                .from('projects')
                .select('*')
                .ilike('cliente_nome', `%${user.name}%`)
                .order('created_at', { ascending: false });
             
             projectsData = result.data || [];
             projectsError = result.error;
        } else {
            // Admin: Busca tudo
            const result = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });
            
            projectsData = result.data || [];
            projectsError = result.error;
        }
        
        if (projectsError) throw projectsError;

        if (!projectsData) {
            setProjects([]);
            return;
        }

        // --- CÁLCULO FINANCEIRO (Apenas Admin) ---
        let financeMap: Record<string, {receita: number, despesa: number}> = {};
        
        if (user?.role === 'admin' && projectsData.length > 0) {
            const pIds = projectsData.map(p => p.id);
            const { data: financeData } = await supabase
                .from('finance_entries')
                .select('obra_id, tipo, valor')
                .in('obra_id', pIds);
            
            if (financeData) {
                financeData.forEach((entry: FinanceEntry) => {
                    if (!financeMap[entry.obra_id]) {
                        financeMap[entry.obra_id] = { receita: 0, despesa: 0 };
                    }
                    if (entry.tipo === 'receita') {
                        financeMap[entry.obra_id].receita += Number(entry.valor);
                    } else {
                        financeMap[entry.obra_id].despesa += Number(entry.valor);
                    }
                });
            }
        }

        // --- Mapeamento da Equipe e Financeiro ---
        try {
            const projectIds = projectsData.map(p => p.id);
            const { data: teamData, error: teamError } = await supabase
                .from('project_team')
                .select('project_id, user_id')
                .in('project_id', projectIds);
            
            const projectsEnhanced = projectsData.map(p => {
                const teamMembers = teamData 
                    ? teamData.filter((t: any) => t.project_id === p.id).map((t: any) => t.user_id)
                    : [];
                
                // Dados Financeiros
                const fin = financeMap[p.id] || { receita: 0, despesa: 0 };
                const valorContrato = Number(p.valor_contrato || 0);

                return { 
                    ...p, 
                    equipe_ids: teamMembers,
                    total_recebido: fin.receita,
                    total_gasto: fin.despesa,
                    saldo_receber: valorContrato - fin.receita
                };
            });
            
            setProjects(projectsEnhanced);
        } catch (innerErr) {
            setProjects(projectsData.map(p => ({ ...p, equipe_ids: [] })));
        }

    } catch (error: any) {
        console.error("Error fetching projects", error.message || error);
        if (error.message?.includes('policy') || error.message?.includes('recursion')) {
             setProjects([]);
        }
    } finally {
        setLoading(false);
    }
  };

  const fetchUsers = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        if (data) {
            setAllUsers(data);
            setResponsibleUsers(data.filter(u => 
                ['engenheiro', 'arquiteto'].includes(u.role)
            ));
            setElectricianUsers(data.filter(u => 
                ['eletricista', 'admin'].includes(u.role)
            ));
        }
      } catch (err) {
        console.error('Error fetching users for selects', err);
      }
  };

  useEffect(() => {
    if (user) {
        fetchProjects();
        fetchUsers();
    }
  }, [user]);

  const handleRefresh = () => {
      fetchProjects();
  };

  const copyFixScript = () => {
    const script = `
-- Script de Correção TOTAL de Exclusão (CASCADE DELETE)
ALTER TABLE public.project_team DROP CONSTRAINT IF EXISTS project_team_project_id_fkey;
ALTER TABLE public.project_materials DROP CONSTRAINT IF EXISTS project_materials_project_id_fkey;
ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS project_documents_project_id_fkey;
ALTER TABLE public.finance_entries DROP CONSTRAINT IF EXISTS finance_entries_obra_id_fkey;
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_obra_id_fkey;
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_obra_id_fkey;

ALTER TABLE public.project_team ADD CONSTRAINT project_team_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_materials ADD CONSTRAINT project_materials_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.finance_entries ADD CONSTRAINT finance_entries_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.checklists ADD CONSTRAINT checklists_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admin delete projects" ON public.projects;
CREATE POLICY "Admin delete projects" ON public.projects FOR DELETE USING (is_admin());
`;
    navigator.clipboard.writeText(script);
    alert('Script copiado! Cole no SQL Editor do Supabase e execute.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'concluido': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'pausado': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    }
  };

  const getStatusLabel = (status: string) => {
    return status ? status.replace('_', ' ').toUpperCase() : 'N/A';
  };

  const requestDelete = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setProjectToDelete(id);
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    try {
        setLoading(true);

        const { error } = await supabase.from('projects').delete().eq('id', projectToDelete);
        
        if (!error) {
            setProjects(prev => prev.filter(p => p.id !== projectToDelete));
            setIsDeleteModalOpen(false);
            setProjectToDelete(null);
            alert('Obra excluída com sucesso.');
        } else {
            console.error('Delete error:', error);
            
            // Tratamento Agressivo: Se falhar por qualquer motivo, oferece o script
            const userCopy = confirm("ERRO AO EXCLUIR: O banco de dados bloqueou a exclusão.\n\nIsso acontece quando falta a permissão 'CASCADE' no banco.\n\nDeseja copiar o Script SQL de Correção Definitiva?");
            
            if (userCopy) {
                copyFixScript();
            }
        }
    } catch (err: any) {
        console.error('Delete error catch:', err);
        copyFixScript();
    } finally {
        setLoading(false);
    }
  };

  const handleEdit = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(project);
    setIsModalOpen(true);
    try {
        const { data: teamData } = await supabase
            .from('project_team')
            .select('user_id')
            .eq('project_id', project.id);
        
        if (teamData) {
            const currentTeamIds = teamData.map(t => t.user_id);
            setFormData(prev => ({ ...prev, equipe_ids: currentTeamIds }));
        }
    } catch (err) {
        console.error('Erro ao buscar equipe atual da obra:', err);
    }
  };

  const handleCreate = () => {
    setFormData({
      status: 'planejamento',
      progresso: 0,
      valor_contrato: 0,
      data_inicio: new Date().toISOString().split('T')[0],
      data_prevista_fim: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      equipe_ids: []
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.cliente_nome || !formData.responsavel_id) {
      alert('Por favor, preencha os campos obrigatórios.');
      return;
    }

    // Validação Robusta de Datas
    if (formData.data_inicio && formData.data_prevista_fim) {
        // Converte strings 'YYYY-MM-DD' para data para comparação segura
        const start = new Date(formData.data_inicio);
        const end = new Date(formData.data_prevista_fim);

        if (start > end) {
            alert('⚠️ ERRO DE DATA:\n\nA Data de Início não pode ser posterior à Data Prevista de Fim.\nPor favor, corrija as datas antes de salvar.');
            return; // Bloqueia o salvamento
        }
    }

    setIsSaving(true);
    const { equipe_ids, ...projectData } = formData;
    
    // Remove campos calculados do frontend antes de enviar
    const { total_recebido, total_gasto, saldo_receber, ...safeProjectData } = projectData as ProjectWithFinance;

    const projectPayload = {
        ...safeProjectData,
        progresso: Number(formData.progresso || 0),
        valor_contrato: Number(formData.valor_contrato || 0)
    };

    try {
        let projectId = formData.id;

        if (projectId) {
            const { error } = await supabase.from('projects').update(projectPayload).eq('id', projectId);
            if (error) {
                 if (error.message?.includes('valor_contrato')) {
                    const fixCmd = "ALTER TABLE public.projects ADD COLUMN valor_contrato numeric DEFAULT 0;";
                    prompt("Erro: Coluna 'valor_contrato' não existe. Copie e rode este SQL no Supabase:", fixCmd);
                 }
                 throw error;
            }
        } else {
            const { data, error } = await supabase.from('projects').insert(projectPayload).select().single();
             if (error) {
                 if (error.message?.includes('valor_contrato')) {
                    const fixCmd = "ALTER TABLE public.projects ADD COLUMN valor_contrato numeric DEFAULT 0;";
                    prompt("Erro: Coluna 'valor_contrato' não existe. Copie e rode este SQL no Supabase:", fixCmd);
                 }
                 throw error;
            }
            projectId = data.id;
        }

        if (projectId && equipe_ids !== undefined) {
            const { error: deleteError } = await supabase.from('project_team').delete().eq('project_id', projectId);
            if (deleteError) console.warn(deleteError);

            if (equipe_ids.length > 0) {
                const teamPayload = equipe_ids.map(userId => ({
                    project_id: projectId,
                    user_id: userId
                }));
                const { error: insertError } = await supabase.from('project_team').insert(teamPayload);
                if (insertError) {
                    alert('Obra salva, mas houve erro ao salvar a equipe.');
                    throw insertError;
                }
            }
        }

        await fetchProjects();
        setIsModalOpen(false);
        alert(`Obra salva com sucesso! ${equipe_ids?.length ? equipe_ids.length + ' membros vinculados.' : ''}`);
        
    } catch (error: any) {
        console.error('Erro ao salvar obra:', error);
        alert(`Erro ao salvar obra: ${error.message}`);
    } finally {
        setIsSaving(false);
    }
  };

  const toggleElectrician = (id: string) => {
    setFormData(prev => {
      const current = prev.equipe_ids || [];
      if (current.includes(id)) {
        return { ...prev, equipe_ids: current.filter(eid => eid !== id) };
      } else {
        return { ...prev, equipe_ids: [...current, id] };
      }
    });
  };

  const filteredData = projects.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(filter.toLowerCase()) || 
                          p.cliente_nome.toLowerCase().includes(filter.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const columns: Column<ProjectWithFinance>[] = [
    { header: 'Obra', accessor: (p) => (
      <div>
        <p className="font-semibold text-white">{p.nome}</p>
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <MapPin size={12} className="mr-1" />
          {p.endereco}
        </div>
      </div>
    )},
    { header: 'Responsável', accessor: (p) => {
      const resp = allUsers.find(u => u.id === p.responsavel_id);
      return (
        <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${resp?.role === 'engenheiro' ? 'bg-blue-600' : resp?.role === 'arquiteto' ? 'bg-pink-600' : 'bg-gray-700'}`}>
                {resp?.name.charAt(0) || '?'}
            </div>
            <span className="text-sm text-gray-300">{resp?.name || 'Não definido'}</span>
        </div>
      )
    }},
    { header: 'Status', accessor: (p) => (
      <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(p.status)}`}>
        {getStatusLabel(p.status)}
      </span>
    )},
    // COLUNA FINANCEIRA (Apenas Admin)
    ...(user?.role === 'admin' ? [{
        header: 'Financeiro', 
        accessor: (p: ProjectWithFinance) => {
            const received = Number(p.total_recebido || 0);
            const contract = Number(p.valor_contrato || 0);
            const spent = Number(p.total_gasto || 0);
            const percent = contract > 0 ? (received / contract) * 100 : 0;

            return (
                <div className="text-xs space-y-2 min-w-[140px]">
                    <div className="flex justify-between items-center text-gray-300">
                        <span className="flex items-center gap-1"><Briefcase size={10}/> Contrato</span>
                        <span className="font-bold">R$ {contract.toLocaleString('pt-BR', {minimumFractionDigits:0})}</span>
                    </div>
                    
                    <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                         <div className="bg-green-500 h-full" style={{width: `${Math.min(percent, 100)}%`}}></div>
                    </div>

                    <div className="flex justify-between items-center text-green-400">
                         <span className="flex items-center gap-1"><TrendingUp size={10}/> Recebido</span>
                         <span>R$ {received.toLocaleString('pt-BR', {minimumFractionDigits:0})}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-orange-400 border-t border-gray-700 pt-1 mt-1">
                         <span className="flex items-center gap-1"><Wallet size={10}/> Falta</span>
                         <span>R$ {Number(p.saldo_receber).toLocaleString('pt-BR', {minimumFractionDigits:0})}</span>
                    </div>

                    <div className="flex justify-between items-center text-red-400">
                        <span className="flex items-center gap-1"><TrendingDown size={10}/> Gastos</span>
                        <span>R$ {spent.toLocaleString('pt-BR', {minimumFractionDigits:0})}</span>
                    </div>
                </div>
            )
        }
    }] : []),
    { header: 'Progresso', accessor: (p) => (
      <div className="w-full max-w-[80px] flex items-center">
        <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden mr-2">
          <div className="h-full bg-primary" style={{ width: `${p.progresso || 0}%` }} />
        </div>
        <span className="text-[10px] text-gray-400">{p.progresso}%</span>
      </div>
    )},
    { header: 'Ações', className: 'text-right', accessor: (p) => (
      user?.role === 'admin' && (
        <div className="flex justify-end gap-2">
          <button onClick={(e) => handleEdit(p, e)} className="p-2 hover:bg-gray-700 rounded-lg text-blue-400">
            <Edit2 size={16} />
          </button>
          <button onClick={(e) => requestDelete(p.id, e)} className="p-2 hover:bg-gray-700 rounded-lg text-red-400">
            <Trash2 size={16} />
          </button>
        </div>
      )
    )}
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Obras</h1>
        
        <div className="flex gap-2 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar obra..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-secondary border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-48 bg-secondary border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-primary appearance-none cursor-pointer"
            >
                <option value="all">Todos os Status</option>
                <option value="planejamento">Planejamento</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="pausado">Pausado</option>
                <option value="concluido">Concluído</option>
            </select>
          </div>
          
          <button onClick={handleRefresh} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={handleCreate}
              className="flex items-center justify-center bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium shrink-0"
            >
              <Plus size={20} className="md:mr-2" />
              <span className="hidden md:inline">Nova Obra</span>
            </button>
          )}
        </div>
      </div>

      {rlsError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl mb-4 text-sm flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <div className="flex gap-3">
                <AlertCircle className="shrink-0" />
                <div>
                    <p className="font-bold">Aviso de Permissão (RLS)</p>
                    <p>O sistema detectou que você está na equipe, mas o banco de dados bloqueou o acesso aos detalhes das obras.</p>
                </div>
              </div>
              <button onClick={copyFixScript} className="mt-2 md:mt-0 flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-bold border border-gray-600">
                <Terminal size={14} /> Copiar Script SQL de Correção
              </button>
          </div>
      )}

      {loading ? (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-primary" size={32} />
          </div>
      ) : (
        <MobileCardTable 
            data={filteredData}
            columns={columns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => navigate(`/obras/${item.id}`)}
            emptyMessage="Nenhuma obra encontrada."
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Confirmar Exclusão"
        maxWidth="sm"
      >
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Excluir Obra?</h3>
              <p className="text-sm text-gray-400 mb-6">
                  Esta ação é irreversível. Todos os dados vinculados (financeiro, equipe, materiais) serão apagados.
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
                    Sim, Excluir
                  </button>
              </div>
          </div>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? 'Editar Obra' : 'Nova Obra'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Obra *</label>
                <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-gray-500" size={18} />
                    <input type="text" required value={formData.nome || ''} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 p-2.5 text-white focus:border-primary focus:outline-none"/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Cliente *</label>
                <input type="text" required value={formData.cliente_nome || ''} onChange={e => setFormData({...formData, cliente_nome: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none"/>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Responsável Técnico *</label>
                <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-500" size={18} />
                    <select required value={formData.responsavel_id || ''} onChange={e => setFormData({...formData, responsavel_id: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 p-2.5 text-white focus:border-primary focus:outline-none appearance-none">
                    <option value="">Selecione...</option>
                    {responsibleUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ProjectStatus})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none">
                    <option value="planejamento">Planejamento</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="pausado">Pausado</option>
                    <option value="concluido">Concluído</option>
                </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Endereço</label>
            <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="text" value={formData.endereco || ''} onChange={e => setFormData({...formData, endereco: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 p-2.5 text-white focus:border-primary focus:outline-none"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Data Início</label>
              <input type="date" value={formData.data_inicio || ''} onChange={e => setFormData({...formData, data_inicio: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Previsão Fim</label>
              <input type="date" value={formData.data_prevista_fim || ''} onChange={e => setFormData({...formData, data_prevista_fim: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none"/>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Valor do Contrato (R$)</label>
            <div className="relative">
                <DollarSign className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="number" step="0.01" value={formData.valor_contrato || ''} onChange={e => setFormData({...formData, valor_contrato: Number(e.target.value)})} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 p-2.5 text-white focus:border-primary focus:outline-none" placeholder="0.00"/>
            </div>
            <p className="text-xs text-gray-500 mt-1">Este valor será usado para cálculo de saldo a receber.</p>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-2">
            <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <HardHat size={16} className="text-primary"/> Equipe Designada (Eletricistas)
            </label>
            <div className="grid grid-cols-2 gap-2 bg-gray-900/50 p-3 rounded-lg border border-gray-700 max-h-40 overflow-y-auto">
                {electricianUsers.map(elec => (
                    <label key={elec.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer">
                        <input type="checkbox" checked={formData.equipe_ids?.includes(elec.id)} onChange={() => toggleElectrician(elec.id)} className="rounded border-gray-600 text-primary focus:ring-primary"/>
                        <span className="text-sm text-gray-300">{elec.name}</span>
                    </label>
                ))}
                {electricianUsers.length === 0 && <p className="text-xs text-gray-500 col-span-2">Nenhum eletricista cadastrado.</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-medium">Cancelar</button>
            <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 font-bold flex items-center justify-center">
              {isSaving ? <Loader2 className="animate-spin" /> : 'Salvar Obra'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Projects;
