
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Project, Client } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Search, Calendar, MapPin, User, Filter, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

interface ProjectWithStats extends Project {
  totalExpenses?: number;
}

export const ProjectList: React.FC = () => {
  const { profile } = useAuthStore();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, aberta, concluida, pausada

  // Form State
  const [newProject, setNewProject] = useState({
    name: '',
    address: '',
    city: '',
    client_id: '',
    start_date: '',
    end_date_prediction: '',
    description: '',
    total_value: '',
    amount_received: ''
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (profile) {
      fetchProjects();
      if (isAdmin) fetchClients();
    }
  }, [profile]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      let enhancedProjects: ProjectWithStats[] = [];

      if (isAdmin) {
        // ADMIN: Fetch direct from obras with RLS
        const { data: projectsData, error } = await supabase
          .from('obras')
          .select('*, client:responsaveis(*)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        enhancedProjects = projectsData || [];
      } else {
        // EMPLOYEE: ROBUST FETCH METHOD (Two-Step with Fallback)
        console.log("🔍 Fetching assignments for:", profile!.id);
        
        // 1. Get IDs of projects assigned to me
        const { data: assignments, error: assignError } = await supabase
          .from('obra_funcionarios')
          .select('project_id')
          .eq('user_id', profile!.id);

        if (assignError) {
           console.error("❌ Error fetching assignments:", assignError);
           throw assignError;
        }

        const projectIds = assignments?.map((a: any) => a.project_id) || [];
        console.log("✅ Found Project IDs assigned:", projectIds);

        if (projectIds.length > 0) {
          // 2. Try Fetch details WITH Client (Might fail due to RLS on Responsaveis if not configured)
          let projectsData: any[] | null = null;
          
          const { data: projectsWithClient, error: joinError } = await supabase
            .from('obras')
            .select('*, client:responsaveis(*)')
            .in('id', projectIds)
            .order('created_at', { ascending: false });

          if (joinError || !projectsWithClient) {
            console.warn("⚠️ Join fetch failed (RLS check?), falling back to raw fetch.", joinError);
            
            // Fallback: Fetch WITHOUT client join
            const { data: rawProjects, error: rawError } = await supabase
              .from('obras')
              .select('*')
              .in('id', projectIds)
              .order('created_at', { ascending: false });
              
            if (rawError) throw rawError;
            projectsData = rawProjects;
          } else {
            projectsData = projectsWithClient;
          }
          
          enhancedProjects = projectsData || [];
        } else {
          console.log("ℹ️ No projects assigned to this user.");
          enhancedProjects = [];
        }
      }

      // Admin: Fetch expenses to show "Spent" amount on card
      if (isAdmin && enhancedProjects.length > 0) {
         const { data: expenses } = await supabase
          .from('gastos')
          .select('project_id, amount')
          .eq('status', 'aprovado');
         
         if (expenses) {
            enhancedProjects = enhancedProjects.map(p => {
               const projExpenses = expenses
                .filter(e => e.project_id === p.id)
                .reduce((sum, e) => sum + e.amount, 0);
               return { ...p, totalExpenses: projExpenses };
            });
         }
      }

      setProjects(enhancedProjects);
    } catch (err: any) {
      console.error('❌ Fatal error fetching projects:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('responsaveis').select('*');
      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error('Error fetching clients:', err.message || err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('obras').insert([{
        ...newProject,
        total_value: newProject.total_value ? parseFloat(newProject.total_value) : 0,
        amount_received: newProject.amount_received ? parseFloat(newProject.amount_received) : 0,
        status: 'aberta'
      }]);
      
      if (error) throw error;

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'CREATE_PROJECT',
        details: `Obra criada: ${newProject.name}`
      });

      setIsModalOpen(false);
      fetchProjects();
      // Reset form
      setNewProject({ name: '', address: '', city: '', client_id: '', start_date: '', end_date_prediction: '', description: '', total_value: '', amount_received: '' });
    } catch (err: any) {
      alert('Erro ao criar obra: ' + err.message);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Obras e Projetos</h1>
          <p className="text-gray-400">Gerencie o andamento das instalações</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsModalOpen(true)} className="shadow-glow">
            <Plus size={18} className="mr-2" /> Nova Obra
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2 text-gray-500 text-sm font-mono uppercase">
            <Filter size={14} /> Filtros:
          </div>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'aberta', label: 'Em Aberto' },
            { id: 'concluida', label: 'Concluídas' },
            { id: 'pausada', label: 'Pausadas' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all border
                ${statusFilter === filter.id
                  ? 'bg-marvil-orange border-marvil-orange text-white shadow-glow'
                  : 'bg-marvil-dark border-marvil-border text-gray-500 hover:border-gray-400 hover:text-gray-300'
                }
              `}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
          <Input 
            className="pl-10" 
            placeholder="Buscar por nome ou endereço..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500 animate-pulse">
           <p>Carregando obras...</p>
           <p className="text-xs text-gray-600 mt-2">Sincronizando banco de dados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="block">
                <div className="bg-marvil-card border border-marvil-border rounded-lg p-5 hover:border-marvil-orange transition-colors h-full flex flex-col group">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase 
                      ${project.status === 'aberta' ? 'bg-green-900/30 text-green-500' : 
                        project.status === 'pausada' ? 'bg-yellow-900/30 text-yellow-500' :
                        'bg-blue-900/30 text-blue-500'}`}>
                      {project.status === 'concluida' ? 'Concluída' : project.status}
                    </div>
                    <span className="text-xs text-gray-500">{project.city}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-marvil-orange transition-colors">{project.name}</h3>
                  <div className="flex items-start gap-2 text-gray-400 text-sm mb-4">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{project.address}</span>
                  </div>

                  {/* ADMIN: Detailed Financial Summary */}
                  {isAdmin && (
                    <div className="bg-black/30 rounded p-3 mb-4 space-y-3 border border-white/5">
                       
                       {/* Gastos */}
                       <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Gastos Totais</span>
                          <span className="text-red-400 font-medium">R$ {(project.totalExpenses || 0).toFixed(2)}</span>
                       </div>

                       {/* Recebido */}
                       <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Valor Recebido</span>
                          <span className="text-green-400 font-medium">R$ {(project.amount_received || 0).toFixed(2)}</span>
                       </div>

                       {/* Progress Bar: Received vs Total */}
                       {(project.total_value || 0) > 0 && (
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                           <div 
                             className="bg-green-600 h-full" 
                             style={{ width: `${Math.min(((project.amount_received || 0) / (project.total_value || 1)) * 100, 100)}%` }}
                             title={`Recebido: ${((project.amount_received || 0) / (project.total_value || 1) * 100).toFixed(0)}%`}
                           />
                        </div>
                       )}

                       {/* A Receber */}
                       <div className="flex justify-between text-xs font-bold pt-2 border-t border-white/10">
                          <span className="text-gray-400">A Receber</span>
                          <span className="text-yellow-500">
                            R$ {((project.total_value || 0) - (project.amount_received || 0)).toFixed(2)}
                          </span>
                       </div>
                    </div>
                  )}

                  <div className="border-t border-marvil-border pt-4 mt-auto space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <User size={14} />
                      <span>{project.client?.name || 'Cliente não informado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar size={14} />
                      <span>Prev: {new Date(project.end_date_prediction).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-10 text-gray-500 bg-marvil-card border border-marvil-border rounded-lg">
              <p>Nenhuma obra encontrada com os filtros atuais.</p>
              {statusFilter !== 'all' && (
                <button onClick={() => setStatusFilter('all')} className="text-marvil-orange text-sm mt-2 hover:underline">
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal (Admin Only) */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-marvil-card border border-marvil-border rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">Cadastrar Nova Obra</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input label="Nome da Obra" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} required />
              <Input label="Endereço" value={newProject.address} onChange={e => setNewProject({...newProject, address: e.target.value})} required />
              <Input label="Cidade" value={newProject.city} onChange={e => setNewProject({...newProject, city: e.target.value})} required />
              
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Responsável/Cliente</label>
                <select 
                  className="w-full bg-marvil-dark border border-marvil-border rounded px-4 py-2.5 text-white focus:border-marvil-orange outline-none"
                  value={newProject.client_id}
                  onChange={e => setNewProject({...newProject, client_id: e.target.value})}
                  required
                >
                  <option value="">Selecione...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input type="date" label="Início" value={newProject.start_date} onChange={e => setNewProject({...newProject, start_date: e.target.value})} required />
                <Input type="date" label="Previsão Fim" value={newProject.end_date_prediction} onChange={e => setNewProject({...newProject, end_date_prediction: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-marvil-dark p-3 rounded border border-marvil-border">
                  <div className="col-span-2 text-xs text-marvil-orange font-bold uppercase mb-1">Dados Financeiros (Admin)</div>
                  <Input 
                    type="number" 
                    step="0.01" 
                    label="Valor Total Cobrado" 
                    placeholder="0.00"
                    value={newProject.total_value} 
                    onChange={e => setNewProject({...newProject, total_value: e.target.value})} 
                  />
                  <Input 
                    type="number" 
                    step="0.01" 
                    label="Já Recebido (Entrada)" 
                    placeholder="0.00"
                    value={newProject.amount_received} 
                    onChange={e => setNewProject({...newProject, amount_received: e.target.value})} 
                  />
              </div>

              <div className="w-full">
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Descrição</label>
                <textarea 
                  className="w-full bg-marvil-dark border border-marvil-border rounded px-4 py-2.5 text-white focus:border-marvil-orange outline-none h-24"
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1">Criar Obra</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
