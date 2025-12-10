
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, User, Package, DollarSign, Plus, Info, FileText, Upload, Download, FileImage, File, Wallet, TrendingDown, Edit2, TrendingUp, CheckCircle, Trash2, AlertTriangle, Save, X, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { ProjectMaterial, FinanceEntry, ProjectDocument, DocumentType, Project, User as AppUser } from '../types';
import MobileCardTable, { Column } from '../components/MobileCardTable';
import Modal from '../components/Modal';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'materials' | 'expenses' | 'documents'>('details');

  const [project, setProject] = useState<Project | null>(null);
  const [responsible, setResponsible] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Materials State
  const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<ProjectMaterial>>({
    nome: '', quantidade: 1, unidade: 'un', valor_estimado: 0
  });
  
  // Delete Material Modal
  const [isDeleteMaterialModalOpen, setIsDeleteMaterialModalOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);

  // Expenses State
  const [expenses, setExpenses] = useState<FinanceEntry[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState<Partial<FinanceEntry>>({
    tipo: 'despesa', categoria: 'Alimentação', valor: 0, observacao: '', data: new Date().toISOString().split('T')[0]
  });
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  
  // Delete Expense Modal
  const [isDeleteExpenseModalOpen, setIsDeleteExpenseModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Contract Edit State
  const [isContractEditing, setIsContractEditing] = useState(false);
  const [contractValueInput, setContractValueInput] = useState('');

  // Documents State
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);

  // Calculated Totals
  const totalMaterialCost = useMemo(() => {
    return materials.reduce((acc, m) => acc + (Number(m.valor_estimado || 0) * Number(m.quantidade || 0)), 0);
  }, [materials]);

  // Fetch Data
  const fetchProjectDetails = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // 1. Project
        const { data: proj, error: projError } = await supabase.from('projects').select('*').eq('id', id).single();
        if (projError) throw projError;
        setProject(proj);
        setContractValueInput(proj.valor_contrato?.toString() || '0');

        // 2. Responsible
        if (proj.responsavel_id) {
            const { data: resp } = await supabase.from('profiles').select('*').eq('id', proj.responsavel_id).single();
            setResponsible(resp);
        }

        // 3. Materials
        const { data: mats } = await supabase.from('project_materials').select('*').eq('project_id', id);
        setMaterials(mats || []);

        // 4. Expenses (Fetch all for admin, filter later if needed)
        const { data: exps } = await supabase.from('finance_entries').select('*').eq('obra_id', id).order('data', { ascending: false });
        setExpenses(exps || []);

        // 5. Users (for expense mapping)
        const { data: usersData } = await supabase.from('profiles').select('id, name');
        setAllUsers(usersData || []);

        // 6. Documents
        const { data: docs } = await supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false });
        setDocuments(docs || []);

      } catch (err: any) {
          console.error('Error loading project:', err);
          if (err.message?.includes('violates row-level security')) {
              alert('Erro de permissão ao carregar dados. Contate o administrador.');
          }
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchProjectDetails();
  }, [id]);

  const handleSaveContract = async () => {
      if (!project) return;
      try {
          const val = Number(contractValueInput.replace(',', '.'));
          const { error } = await supabase.from('projects').update({ valor_contrato: val }).eq('id', project.id);
          
          if (error) throw error;
          
          setProject(prev => prev ? ({ ...prev, valor_contrato: val }) : null);
          setIsContractEditing(false);
          alert('Valor do contrato atualizado!');
      } catch (err: any) {
          console.error(err);
           if (err.message?.includes('valor_contrato')) {
               const fixCmd = "ALTER TABLE public.projects ADD COLUMN valor_contrato numeric DEFAULT 0;";
               prompt("Erro: Coluna 'valor_contrato' não existe. Copie e rode este SQL no Supabase:", fixCmd);
           } else {
               alert('Erro ao salvar contrato: ' + err.message);
           }
      }
  };

  // --- Material Handlers ---
  const handleOpenMaterialModal = (material?: ProjectMaterial) => {
      if (material) {
          setEditingMaterialId(material.id);
          setNewMaterial(material);
      } else {
          setEditingMaterialId(null);
          setNewMaterial({ nome: '', quantidade: 1, unidade: 'un', valor_estimado: 0 });
      }
      setIsMaterialModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !newMaterial.nome) return;

      const payload = { ...newMaterial, project_id: id };
      
      try {
          if (editingMaterialId) {
             const { error } = await supabase.from('project_materials').update(payload).eq('id', editingMaterialId);
             if (error) throw error;
          } else {
             const { error } = await supabase.from('project_materials').insert(payload);
             if (error) throw error;
          }
          await fetchProjectDetails();
          setIsMaterialModalOpen(false);
      } catch (err) {
          alert('Erro ao salvar material.');
      }
  };

  const requestDeleteMaterial = (matId: string) => {
      setMaterialToDelete(matId);
      setIsDeleteMaterialModalOpen(true);
  };

  const confirmDeleteMaterial = async () => {
      if (!materialToDelete) return;
      
      try {
        const { error } = await supabase.from('project_materials').delete().eq('id', materialToDelete);
        
        if (error) throw error;
        
        setMaterials(prev => prev.filter(m => m.id !== materialToDelete));
        setIsDeleteMaterialModalOpen(false);
        setMaterialToDelete(null);
      } catch (err: any) {
        console.error("Delete material error:", err);
        const fixCmd = `DROP POLICY IF EXISTS "Admin delete materials" ON public.project_materials; CREATE POLICY "Admin delete materials" ON public.project_materials FOR DELETE USING (is_admin());`;
        
        // Extract safe message
        let msg = err.message || 'Erro desconhecido';
        if (msg.includes('row-level security')) {
             prompt("Erro de Permissão (RLS). Copie e rode este script no Supabase:", fixCmd);
        } else {
             alert(`Erro ao excluir: ${msg}`);
        }
      }
  };

  // --- Expense Handlers ---
  const handleOpenExpenseModal = (expense?: FinanceEntry) => {
      if (expense) {
          setEditingExpenseId(expense.id);
          setNewExpense(expense);
      } else {
          setEditingExpenseId(null);
          setNewExpense({ 
              tipo: 'despesa', 
              categoria: 'Alimentação', 
              valor: 0, 
              observacao: '', 
              data: new Date().toISOString().split('T')[0] 
            });
      }
      setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !user) return;
      if (!newExpense.data) {
          alert("Por favor, selecione uma data.");
          return;
      }

      const payload = { ...newExpense, obra_id: id, user_id: user.id };
      
      try {
          if (editingExpenseId) {
              const { error } = await supabase.from('finance_entries').update(payload).eq('id', editingExpenseId);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('finance_entries').insert(payload);
              if (error) throw error;
          }
          await fetchProjectDetails();
          setIsExpenseModalOpen(false);
      } catch (err: any) {
          console.error(err);
          if (err.code === '42501') { // RLS Error
               const script = `DROP POLICY IF EXISTS "Gerir financeiro" ON public.finance_entries; CREATE POLICY "Admin gerencia financeiro completo" ON public.finance_entries FOR ALL USING ( is_admin() OR auth.uid() = user_id );`;
               prompt("Erro de Permissão (RLS). Copie e rode este script no Supabase:", script);
          } else {
               alert('Erro ao salvar lançamento: ' + err.message);
          }
      }
  };

  const requestDeleteExpense = (expId: string) => {
      setExpenseToDelete(expId);
      setIsDeleteExpenseModalOpen(true);
  };

  const confirmDeleteExpense = async () => {
      if (!expenseToDelete) return;
      try {
        const { error } = await supabase.from('finance_entries').delete().eq('id', expenseToDelete);
        if (error) throw error;
        setExpenses(prev => prev.filter(e => e.id !== expenseToDelete));
        setIsDeleteExpenseModalOpen(false);
        setExpenseToDelete(null);
      } catch (err: any) {
        console.error(err);
        const fixCmd = "CREATE POLICY \"Admin delete finance\" ON public.finance_entries FOR DELETE USING (is_admin());";
        
        let msg = err.message || 'Erro desconhecido';
        if (msg.includes('row-level security')) {
            prompt("Erro ao excluir. Falta permissão DELETE. Copie e rode:", fixCmd);
        } else {
            alert(`Erro ao excluir: ${msg}`);
        }
      }
  };

  // Filtered lists
  const filteredExpenses = useMemo(() => {
    if (user?.role === 'admin') return expenses;
    return expenses.filter(e => e.user_id === user?.id);
  }, [expenses, user]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!project) return <div className="p-8 text-center">Obra não encontrada.</div>;

  const totalReceived = expenses.filter(e => e.tipo === 'receita').reduce((acc, e) => acc + Number(e.valor), 0);
  const totalSpent = expenses.filter(e => e.tipo === 'despesa').reduce((acc, e) => acc + Number(e.valor), 0);
  const contractValue = Number(project.valor_contrato || 0);
  const pendingValue = contractValue - totalReceived;
  const progressPercent = contractValue > 0 ? (totalReceived / contractValue) * 100 : 0;

  // Helper: check if user is tech manager
  const isTech = ['admin', 'engenheiro', 'arquiteto'].includes(user?.role || '');

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/obras')} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{project.nome}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User size={14} /> <span>{project.cliente_nome}</span>
            <span className="mx-1">•</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${project.status === 'planejamento' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' : 'text-blue-400 border-blue-400/30 bg-blue-400/10'}`}>
              {project.status.toUpperCase().replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        <button onClick={() => setActiveTab('details')} className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}>Visão Geral</button>
        <button onClick={() => setActiveTab('materials')} className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === 'materials' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}>Materiais</button>
        <button onClick={() => setActiveTab('expenses')} className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === 'expenses' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}>Gastos</button>
        <button onClick={() => setActiveTab('documents')} className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}>Documentos</button>
      </div>

      {/* Content */}
      <div className="flex-1">
        
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Admin Financial Dashboard */}
            {user?.role === 'admin' && (
                <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Wallet className="text-primary" size={20} /> Financeiro da Obra
                        </h3>
                        {isContractEditing ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    autoFocus
                                    type="text" 
                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm w-32"
                                    value={contractValueInput}
                                    onChange={e => setContractValueInput(e.target.value)}
                                />
                                <button onClick={handleSaveContract} className="p-1 bg-green-600 rounded hover:bg-green-500 text-white"><CheckCircle size={16}/></button>
                                <button onClick={() => setIsContractEditing(false)} className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-white"><X size={16}/></button>
                            </div>
                        ) : (
                             <button onClick={() => setIsContractEditing(true)} className="text-xs text-gray-500 hover:text-primary flex items-center gap-1">
                                <Edit2 size={12} /> Editar Contrato
                             </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                            <p className="text-gray-400 text-xs uppercase font-bold mb-1">Valor Contrato</p>
                            <p className="text-xl font-bold text-white">R$ {contractValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
                            <p className="text-green-400 text-xs uppercase font-bold mb-1">Recebido</p>
                            <p className="text-xl font-bold text-green-400">R$ {totalReceived.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/20">
                            <p className="text-orange-400 text-xs uppercase font-bold mb-1">A Receber</p>
                            <p className="text-xl font-bold text-orange-400">R$ {pendingValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progresso Financeiro</span>
                            <span>{progressPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-secondary p-5 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">Informações</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="text-gray-500 mt-1" size={18} />
                    <div>
                      <p className="text-gray-400 text-sm">Endereço</p>
                      <p className="text-white">{project.endereco}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="text-gray-500 mt-1" size={18} />
                    <div>
                      <p className="text-gray-400 text-sm">Período</p>
                      <p className="text-white">
                        {new Date(project.data_inicio).toLocaleDateString()} até {new Date(project.data_prevista_fim).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="text-gray-500 mt-1" size={18} />
                    <div>
                      <p className="text-gray-400 text-sm">Responsável Técnico</p>
                      <p className="text-white">{responsible?.name || 'Não definido'}</p>
                      <p className="text-xs text-gray-500 capitalize">{responsible?.role}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-secondary p-5 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">Métricas</h3>
                <div className="space-y-4">
                   <div>
                      <div className="flex justify-between mb-1">
                         <span className="text-sm text-gray-400">Progresso Físico</span>
                         <span className="text-sm text-white font-bold">{project.progresso}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                         <div className="bg-primary h-2 rounded-full" style={{ width: `${project.progresso}%` }}></div>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="bg-gray-800 p-3 rounded-lg text-center">
                          <p className="text-2xl font-bold text-white">{materials.length}</p>
                          <p className="text-xs text-gray-500">Materiais</p>
                      </div>
                      <div className="bg-gray-800 p-3 rounded-lg text-center">
                          <p className="text-2xl font-bold text-white">{documents.length}</p>
                          <p className="text-xs text-gray-500">Documentos</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MATERIALS TAB */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
             {/* Total Estimated Cost Card - Visible to Admin, Engineer, Architect */}
             {isTech && (
                 <div className="bg-secondary p-4 rounded-xl border border-gray-800 flex justify-between items-center shadow-sm">
                     <div>
                         <p className="text-sm text-gray-400">Custo Estimado de Materiais</p>
                         <p className="text-2xl font-bold text-white">R$ {totalMaterialCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                     </div>
                     <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
                         <Package size={24} />
                     </div>
                 </div>
             )}

             <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Lista de Materiais</h3>
                {user?.role === 'admin' && (
                    <button 
                        onClick={() => handleOpenMaterialModal()}
                        className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-orange-600 transition-colors"
                    >
                        <Plus size={16} /> Adicionar
                    </button>
                )}
             </div>

             <MobileCardTable<ProjectMaterial>
                data={materials}
                keyExtractor={m => m.id}
                emptyMessage="Nenhum material cadastrado."
                columns={[
                    { header: 'Item', accessor: 'nome' },
                    { header: 'Qtd', accessor: (m) => <span className="font-mono text-white">{m.quantidade} <span className="text-gray-500 text-xs">{m.unidade}</span></span> },
                    ...(isTech ? [{
                        header: 'Valor Unit.', 
                        accessor: (m: ProjectMaterial) => `R$ ${Number(m.valor_estimado || 0).toFixed(2)}`
                    }, {
                        header: 'Total',
                        accessor: (m: ProjectMaterial) => <span className="text-white font-bold">R$ {(Number(m.valor_estimado || 0) * m.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    }] : []),
                    { header: 'Ações', className: 'text-right', accessor: (m) => (
                        user?.role === 'admin' && (
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenMaterialModal(m)} className="p-2 bg-gray-800 text-blue-400 rounded hover:bg-gray-700"><Edit2 size={16} /></button>
                                <button onClick={() => requestDeleteMaterial(m.id)} className="p-2 bg-gray-800 text-red-400 rounded hover:bg-gray-700"><Trash2 size={16} /></button>
                            </div>
                        )
                    )}
                ]}
             />
          </div>
        )}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
            <div className="space-y-4">
                {/* Admin Totals */}
                {user?.role === 'admin' && (
                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-secondary p-4 rounded-xl border border-gray-800">
                            <p className="text-sm text-gray-400">Total Receitas</p>
                            <p className="text-xl font-bold text-green-400">R$ {totalReceived.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <div className="bg-secondary p-4 rounded-xl border border-gray-800">
                             <p className="text-sm text-gray-400">Total Despesas</p>
                             <p className="text-xl font-bold text-red-400">R$ {totalSpent.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                     </div>
                )}

                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Lançamentos</h3>
                    <button 
                        onClick={() => handleOpenExpenseModal()}
                        className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-orange-600 transition-colors"
                    >
                        <Plus size={16} /> Novo Lançamento
                    </button>
                </div>

                <MobileCardTable<FinanceEntry>
                    data={filteredExpenses}
                    keyExtractor={e => e.id}
                    emptyMessage="Nenhum lançamento financeiro."
                    columns={[
                        { header: 'Data', accessor: (e) => new Date(e.data).toLocaleDateString() },
                        { header: 'Tipo', accessor: (e) => (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${e.tipo === 'receita' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {e.tipo === 'receita' ? 'ENTRADA' : 'SAÍDA'}
                            </span>
                        )},
                        { header: 'Categoria', accessor: 'categoria' },
                        { header: 'Valor', accessor: (e) => <span className={`font-bold ${e.tipo === 'receita' ? 'text-green-400' : 'text-white'}`}>R$ {Number(e.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span> },
                        ...(user?.role === 'admin' ? [{
                            header: 'Usuário',
                            accessor: (e: FinanceEntry) => {
                                const u = allUsers.find(au => au.id === e.user_id);
                                return <span className="text-xs text-gray-400">{u ? u.name : 'Desconhecido'}</span>
                            }
                        }] : []),
                        { header: 'Ações', className: 'text-right', accessor: (e) => (
                             user?.role === 'admin' && (
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleOpenExpenseModal(e)} className="p-2 bg-gray-800 text-blue-400 rounded hover:bg-gray-700"><Edit2 size={16} /></button>
                                    <button onClick={() => requestDeleteExpense(e.id)} className="p-2 bg-gray-800 text-red-400 rounded hover:bg-gray-700"><Trash2 size={16} /></button>
                                </div>
                            )
                        )}
                    ]}
                />
            </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
            <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Arquivos da Obra</h3>
                    <button className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold border border-gray-700 cursor-not-allowed" disabled>
                        <Upload size={16} /> Upload (Em breve)
                    </button>
                </div>
                
                {documents.length === 0 && (
                    <div className="text-center py-8 text-gray-500 border border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                        <File className="mx-auto mb-2 opacity-50" size={32} />
                        <p>Nenhum documento anexado.</p>
                    </div>
                )}
            </div>
        )}

      </div>

      {/* MODALS */}
      
      {/* Material Modal */}
      <Modal isOpen={isMaterialModalOpen} onClose={() => setIsMaterialModalOpen(false)} title={editingMaterialId ? 'Editar Material' : 'Adicionar Material'}>
         <form onSubmit={handleSaveMaterial} className="space-y-4">
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Nome do Material</label>
                 <input required type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" value={newMaterial.nome} onChange={e => setNewMaterial({...newMaterial, nome: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-gray-400 text-sm mb-1">Quantidade</label>
                    <input required type="number" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" value={newMaterial.quantidade} onChange={e => setNewMaterial({...newMaterial, quantidade: Number(e.target.value)})} />
                 </div>
                 <div>
                    <label className="block text-gray-400 text-sm mb-1">Unidade</label>
                    <input required type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" value={newMaterial.unidade} onChange={e => setNewMaterial({...newMaterial, unidade: e.target.value})} />
                 </div>
             </div>
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Valor Estimado (Unitário)</label>
                 <div className="relative">
                     <span className="absolute left-3 top-2 text-gray-500">R$</span>
                     <input type="number" step="0.01" className="w-full bg-gray-800 border border-gray-700 rounded p-2 pl-8 text-white" value={newMaterial.valor_estimado} onChange={e => setNewMaterial({...newMaterial, valor_estimado: Number(e.target.value)})} />
                 </div>
             </div>
             <button type="submit" className="w-full bg-primary text-white py-3 rounded font-bold hover:bg-orange-600">Salvar</button>
         </form>
      </Modal>

      {/* Delete Material Confirmation */}
      <Modal isOpen={isDeleteMaterialModalOpen} onClose={() => setIsDeleteMaterialModalOpen(false)} title="Excluir Material" maxWidth="sm">
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                  <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Excluir Material?</h3>
              <p className="text-sm text-gray-400 mb-6">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                  <button onClick={() => setIsDeleteMaterialModalOpen(false)} className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700">Cancelar</button>
                  <button onClick={confirmDeleteMaterial} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">Excluir</button>
              </div>
          </div>
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={editingExpenseId ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}>
         <form onSubmit={handleSaveExpense} className="space-y-4">
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Tipo</label>
                 <div className="flex gap-2">
                     <button type="button" onClick={() => setNewExpense({...newExpense, tipo: 'despesa'})} className={`${user?.role === 'admin' ? 'flex-1' : 'w-full'} p-2 rounded border ${newExpense.tipo === 'despesa' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>Saída (Despesa)</button>
                     {user?.role === 'admin' && (
                        <button type="button" onClick={() => setNewExpense({...newExpense, tipo: 'receita'})} className={`flex-1 p-2 rounded border ${newExpense.tipo === 'receita' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>Entrada (Receita)</button>
                     )}
                 </div>
             </div>
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Categoria</label>
                 <select className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" value={newExpense.categoria} onChange={e => setNewExpense({...newExpense, categoria: e.target.value})}>
                     {newExpense.tipo === 'despesa' ? (
                         <>
                            <option value="Alimentação">Alimentação</option>
                            <option value="Transporte">Transporte</option>
                            <option value="Materiais Extras">Materiais Extras</option>
                            <option value="Mão de Obra">Mão de Obra</option>
                            <option value="Outros">Outros</option>
                         </>
                     ) : (
                         <>
                            <option value="Pagamento Cliente">Pagamento Cliente</option>
                            <option value="Adiantamento">Adiantamento</option>
                            <option value="Reembolso">Reembolso</option>
                         </>
                     )}
                 </select>
             </div>
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Data</label>
                 <input required type="date" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" value={newExpense.data} onChange={e => setNewExpense({...newExpense, data: e.target.value})} />
             </div>
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Valor</label>
                 <div className="relative">
                     <span className="absolute left-3 top-2 text-gray-500">R$</span>
                     <input required type="number" step="0.01" className="w-full bg-gray-800 border border-gray-700 rounded p-2 pl-8 text-white" value={newExpense.valor} onChange={e => setNewExpense({...newExpense, valor: Number(e.target.value)})} />
                 </div>
             </div>
             <div>
                 <label className="block text-gray-400 text-sm mb-1">Observação</label>
                 <textarea className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" rows={2} value={newExpense.observacao || ''} onChange={e => setNewExpense({...newExpense, observacao: e.target.value})}></textarea>
             </div>
             <button type="submit" className="w-full bg-primary text-white py-3 rounded font-bold hover:bg-orange-600">Salvar Lançamento</button>
         </form>
      </Modal>

      {/* Delete Expense Confirmation */}
      <Modal isOpen={isDeleteExpenseModalOpen} onClose={() => setIsDeleteExpenseModalOpen(false)} title="Excluir Lançamento" maxWidth="sm">
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                  <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Tem certeza?</h3>
              <p className="text-sm text-gray-400 mb-6">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                  <button onClick={() => setIsDeleteExpenseModalOpen(false)} className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700">Cancelar</button>
                  <button onClick={confirmDeleteExpense} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">Excluir</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default ProjectDetails;
