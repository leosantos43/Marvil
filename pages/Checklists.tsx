
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CheckSquare, Check, X, Settings, Trash2, GripVertical, Save, Briefcase, Loader2, Eye, FileText, MessageSquare, AlertTriangle, Filter, Calendar, Search } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChecklistTemplate, ChecklistItemTemplate, Project, Checklist } from '../types';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const Checklists = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'templates'>('pending');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [history, setHistory] = useState<Checklist[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);

  // Filters State (History)
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historySearchFilter, setHistorySearchFilter] = useState('');

  // Selection Flow State
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);

  // Viewer State (For Admins to see filled checklists)
  const [viewingChecklist, setViewingChecklist] = useState<Checklist | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<ChecklistTemplate | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Builder State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<ChecklistTemplate>>({
    nome: '', descricao: '', itens: []
  });

  // Delete Template State
  const [isDeleteTemplateModalOpen, setIsDeleteTemplateModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Delete Checklist History State
  const [isDeleteChecklistModalOpen, setIsDeleteChecklistModalOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<string | null>(null);

  const loadData = async () => {
      setLoading(true);
      try {
          // Templates
          const { data: tpls, error: tplError } = await supabase.from('checklist_templates').select('*');
          if (tplError) throw tplError;
          if (tpls) setTemplates(tpls);

          // History
          let query = supabase
            .from('checklists')
            .select(`
                *,
                checklist_templates ( nome ),
                projects ( nome, cliente_nome ),
                profiles ( name )
            `)
            .order('created_at', { ascending: false });

          if (user?.role === 'eletricista') {
              query = query.eq('responsavel_id', user.id);
          }
          
          const { data: hists, error: histError } = await query;
          
          if (histError) throw histError;
          
          if (hists) {
              const mappedHistory: Checklist[] = hists.map((item: any) => ({
                  ...item,
                  template_nome: item.checklist_templates?.nome || 'Modelo Excluído',
                  obra_nome: item.projects?.nome || 'Obra Excluída',
                  responsavel_nome: item.profiles?.name || 'Usuário'
              }));
              setHistory(mappedHistory);
          }

          // Projects (for selection)
          let projectsList: Project[] = [];

          if (user?.role === 'eletricista') {
              const { data: teamLinks } = await supabase
                  .from('project_team')
                  .select('project_id')
                  .eq('user_id', user.id);
              
              if (teamLinks && teamLinks.length > 0) {
                  const ids = teamLinks.map(t => t.project_id);
                  const { data: projs } = await supabase
                      .from('projects')
                      .select('*')
                      .in('id', ids)
                      .in('status', ['em_andamento', 'planejamento']);
                  projectsList = projs || [];
              }
          } else if (user?.role === 'engenheiro' || user?.role === 'arquiteto') {
               const { data: projs } = await supabase
                  .from('projects')
                  .select('*')
                  .eq('responsavel_id', user.id)
                  .in('status', ['em_andamento', 'planejamento']);
               projectsList = projs || [];
          } else {
              const { data: projs } = await supabase
                  .from('projects')
                  .select('*')
                  .in('status', ['em_andamento', 'planejamento']);
              projectsList = projs || [];
          }

          setAvailableProjects(projectsList);

      } catch (err: any) {
          console.error('Erro ao carregar dados:', err.message || err);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, [user]);

  // --- Filtering Logic ---
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
        // Filter by Date
        if (historyDateFilter && item.data_referencia !== historyDateFilter) {
            return false;
        }
        
        // Filter by Name (Responsible or Project Name)
        if (historySearchFilter) {
            const searchLower = historySearchFilter.toLowerCase();
            const respMatch = item.responsavel_nome?.toLowerCase().includes(searchLower);
            const projMatch = item.obra_nome?.toLowerCase().includes(searchLower);
            
            if (!respMatch && !projMatch) return false;
        }

        return true;
    });
  }, [history, historyDateFilter, historySearchFilter]);

  const clearFilters = () => {
      setHistoryDateFilter('');
      setHistorySearchFilter('');
  };

  // --- View Details Logic ---
  const handleViewDetails = async (checklist: Checklist) => {
      let template = templates.find(t => t.id === checklist.template_id);
      
      if (!template) {
          const { data } = await supabase.from('checklist_templates').select('*').eq('id', checklist.template_id).single();
          if (data) template = data;
      }

      setViewingChecklist(checklist);
      setViewingTemplate(template || null);
      setIsViewModalOpen(true);
  };

  // --- Checklist Filling Logic ---
  
  const initiateChecklistStart = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setIsProjectSelectOpen(true);
  };

  const confirmProjectSelection = (project: Project) => {
    setSelectedProject(project);
    setIsProjectSelectOpen(false);
    setAnswers({});
  };

  const handleAnswer = (itemId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [itemId]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedProject || !selectedTemplate || !user) return;
    
    // VALIDATION: Prevent Duplicate Checklist (Same Template, Same Project, Same Day)
    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
        const { data: duplicates, error: dupError } = await supabase
            .from('checklists')
            .select('id')
            .eq('responsavel_id', user.id)
            .eq('template_id', selectedTemplate.id)
            .eq('obra_id', selectedProject.id)
            .eq('data_referencia', todayStr); // Verifica a data de referência exata

        if (dupError) throw dupError;

        if (duplicates && duplicates.length > 0) {
            alert(`ATENÇÃO: Você já preencheu este checklist ("${selectedTemplate.nome}") para esta obra hoje.\n\nNão é permitido duplicidade no mesmo dia.`);
            return;
        }

    } catch (err) {
        console.error("Erro na validação de duplicidade:", err);
        alert("Erro ao validar checklist. Tente novamente.");
        return;
    }

    // Prepare Payload
    const payload = {
        template_id: selectedTemplate.id,
        obra_id: selectedProject.id,
        responsavel_id: user.id,
        data_referencia: todayStr,
        status: 'concluido',
        respostas: answers
    };

    const { error: insertError } = await supabase.from('checklists').insert(payload);

    if (insertError) {
        console.error('Submission error:', insertError);
        alert('Erro ao salvar checklist: ' + (insertError.message || 'Erro desconhecido'));
    } else {
        alert('Checklist enviado com sucesso!');
        loadData();
        setSelectedTemplate(null);
        setSelectedProject(null);
        setAnswers({});
    }
  };

  // --- Template Builder Logic ---
  const openBuilder = (template?: ChecklistTemplate) => {
    if (template) {
      setEditingTemplate(JSON.parse(JSON.stringify(template)));
    } else {
      setEditingTemplate({ nome: '', descricao: '', itens: [] });
    }
    setIsBuilderOpen(true);
  };

  const addBuilderItem = () => {
    const newItem: ChecklistItemTemplate = {
      id: Date.now().toString(),
      titulo: 'Novo Item',
      tipo_campo: 'boolean',
      obrigatorio: true
    };
    setEditingTemplate(prev => ({ ...prev, itens: [...(prev.itens || []), newItem] }));
  };

  const removeBuilderItem = (idx: number) => {
    setEditingTemplate(prev => {
      const newItens = [...(prev.itens || [])];
      newItens.splice(idx, 1);
      return { ...prev, itens: newItens };
    });
  };

  const updateBuilderItem = (idx: number, field: keyof ChecklistItemTemplate, value: any) => {
    setEditingTemplate(prev => {
      const newItens = [...(prev.itens || [])];
      newItens[idx] = { ...newItens[idx], [field]: value };
      return { ...prev, itens: newItens };
    });
  };

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate.nome) return;

    // Remove ID if present but invalid (generating UUID on DB side usually)
    // But for Supabase, if we want to update, we need ID. If insert, we omit ID.
    const { id, ...templateData } = editingTemplate;
    
    const payload: any = {
        nome: templateData.nome,
        descricao: templateData.descricao,
        itens: templateData.itens
    };

    try {
        if (editingTemplate.id) {
            const { error } = await supabase.from('checklist_templates').update(payload).eq('id', editingTemplate.id);
            if (error) throw error;
        } else {
            // Insert new
            const { error } = await supabase.from('checklist_templates').insert(payload);
            if (error) throw error;
        }
        
        loadData();
        setIsBuilderOpen(false);
    } catch (err: any) {
        alert(`Erro ao salvar modelo: ${err.message}`);
    }
  };

  // --- Delete Template Logic ---
  const requestDeleteTemplate = (id: string) => {
    setTemplateToDelete(id);
    setIsDeleteTemplateModalOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
        const { error } = await supabase.from('checklist_templates').delete().eq('id', templateToDelete);
        
        if (error) throw error;
        
        setTemplates(prev => prev.filter(t => t.id !== templateToDelete));
        setIsDeleteTemplateModalOpen(false);
        setTemplateToDelete(null);
        alert('Modelo de checklist excluído.');

    } catch (err: any) {
        console.error("Delete template error:", err);
        const fixCmd = `DROP POLICY IF EXISTS "Admin gerencia templates" ON public.checklist_templates; CREATE POLICY "Admin gerencia templates completo" ON public.checklist_templates FOR ALL USING ( is_admin() );`;
        
        let msg = err.message || 'Erro desconhecido';
        if (msg.includes('row-level security')) {
             prompt("Erro de Permissão (RLS). Copie e rode este script no Supabase:", fixCmd);
        } else if (msg.includes('violates foreign key constraint')) {
             alert("Não é possível excluir este modelo pois existem checklists preenchidos vinculados a ele.");
        } else {
             alert(`Erro ao excluir: ${msg}`);
        }
    }
  };

  // --- Delete Checklist History Logic ---
  const requestDeleteChecklist = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setChecklistToDelete(id);
      setIsDeleteChecklistModalOpen(true);
  };

  const confirmDeleteChecklist = async () => {
      if (!checklistToDelete) return;

      try {
          const { error } = await supabase.from('checklists').delete().eq('id', checklistToDelete);
          
          if (error) throw error;
          
          setHistory(prev => prev.filter(c => c.id !== checklistToDelete));
          setIsDeleteChecklistModalOpen(false);
          setChecklistToDelete(null);
          alert('Checklist excluído com sucesso.');
      } catch (err: any) {
          console.error("Delete checklist error:", err);
          const fixCmd = `CREATE POLICY "Admin delete checklists" ON public.checklists FOR DELETE USING ( is_admin() );`;

          let msg = err.message || 'Erro desconhecido';
          if (msg.includes('row-level security')) {
               prompt("Erro de Permissão (RLS). Copie e rode este script no Supabase:", fixCmd);
          } else {
               alert(`Erro ao excluir: ${msg}`);
          }
      }
  };


  // --- Render Filling View ---
  if (selectedTemplate && selectedProject) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => { setSelectedTemplate(null); setSelectedProject(null); }}
            className="text-gray-400 hover:text-white"
          >
            Cancelar
          </button>
          <div className="text-right">
              <h2 className="text-xl font-bold text-white truncate">{selectedTemplate.nome}</h2>
              <p className="text-sm text-primary">{selectedProject.nome}</p>
          </div>
        </div>

        <div className="space-y-6 pb-24">
          {selectedTemplate.itens.map((item) => (
            <div key={item.id} className="bg-secondary p-5 rounded-xl border border-gray-700">
              <label className="block text-white font-medium mb-3 text-lg">
                {item.titulo}
                {item.obrigatorio && <span className="text-red-500 ml-1">*</span>}
              </label>

              {item.tipo_campo === 'boolean' && (
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleAnswer(item.id, true)}
                    className={`flex-1 py-4 rounded-lg flex flex-col items-center justify-center border transition-all ${answers[item.id] === true ? 'bg-success/20 border-success text-success' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                  >
                    <Check size={28} className="mb-1" />
                    <span className="font-bold">Sim / OK</span>
                  </button>
                  <button 
                    onClick={() => handleAnswer(item.id, false)}
                    className={`flex-1 py-4 rounded-lg flex flex-col items-center justify-center border transition-all ${answers[item.id] === false ? 'bg-error/20 border-error text-error' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                  >
                    <X size={28} className="mb-1" />
                    <span className="font-bold">Não / Ruim</span>
                  </button>
                </div>
              )}

              {item.tipo_campo === 'number' && (
                <input 
                  type="number"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white text-xl focus:border-primary focus:outline-none"
                  placeholder="0"
                  onChange={(e) => handleAnswer(item.id, parseFloat(e.target.value))}
                />
              )}

              {item.tipo_campo === 'text' && (
                <textarea 
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                  placeholder="Digite observações..."
                  onChange={(e) => handleAnswer(item.id, e.target.value)}
                />
              )}

              {item.tipo_campo === 'options' && (
                <div className="grid grid-cols-1 gap-2">
                  {item.opcoes?.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleAnswer(item.id, opt)}
                      className={`p-3 rounded-lg text-left border ${answers[item.id] === opt ? 'bg-primary/20 border-primary text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Optional Observation Field for Non-Text Fields */}
              {item.tipo_campo !== 'text' && (
                <div className="mt-4 pt-3 border-t border-gray-700/50">
                    <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Adicionar observação (opcional)" 
                            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-9 py-2 text-sm text-gray-300 focus:border-gray-500 focus:outline-none"
                            onChange={(e) => handleAnswer(`${item.id}_obs`, e.target.value)}
                        />
                    </div>
                </div>
              )}

            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 w-full bg-secondary border-t border-gray-800 p-4 md:static md:bg-transparent md:border-0 md:p-0">
          <button 
            onClick={handleSubmit}
            className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            Finalizar Checklist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Checklists</h1>
        {user?.role === 'admin' && activeTab === 'templates' && (
           <button 
             onClick={() => openBuilder()}
             className="md:hidden bg-primary p-2 rounded-lg text-white"
           >
             <Plus size={24} />
           </button>
        )}
      </div>

      <div className="flex space-x-4 border-b border-gray-800 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'pending' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
        >
          Iniciar Novo
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
        >
          Histórico
        </button>
        {user?.role === 'admin' && (
          <button 
            onClick={() => setActiveTab('templates')}
            className={`pb-2 px-4 font-medium transition-colors whitespace-nowrap ${activeTab === 'templates' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Gerenciar Modelos
          </button>
        )}
      </div>

      {loading ? (
           <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <>
            {activeTab === 'pending' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                    <div key={template.id} className="bg-secondary p-6 rounded-xl border border-gray-700 hover:border-primary transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                        <CheckSquare size={24} />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{template.nome}</h3>
                    <p className="text-sm text-gray-400 mb-6 line-clamp-2">{template.descricao}</p>
                    <button 
                        onClick={() => initiateChecklistStart(template)}
                        className="w-full py-3 bg-gray-800 hover:bg-primary text-white rounded-lg transition-colors font-medium border border-gray-700 hover:border-primary"
                    >
                        Iniciar Preenchimento
                    </button>
                    </div>
                ))}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    
                    {/* Admin Filters */}
                    {user?.role === 'admin' && (
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row gap-4 items-center mb-4">
                            <div className="flex items-center gap-2 text-gray-400 shrink-0">
                                <Filter size={18} />
                                <span className="text-sm font-bold uppercase">Filtros</span>
                            </div>
                            
                            <div className="relative flex-1 w-full md:w-auto">
                                <Calendar className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                <input 
                                    type="date"
                                    value={historyDateFilter}
                                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 p-2 text-white text-sm focus:border-primary focus:outline-none"
                                    placeholder="Filtrar por data"
                                />
                            </div>

                            <div className="relative flex-1 w-full md:w-auto">
                                <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                <input 
                                    type="text"
                                    value={historySearchFilter}
                                    onChange={(e) => setHistorySearchFilter(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 p-2 text-white text-sm focus:border-primary focus:outline-none"
                                    placeholder="Buscar por responsável ou obra..."
                                />
                            </div>

                            {(historyDateFilter || historySearchFilter) && (
                                <button 
                                    onClick={clearFilters}
                                    className="text-xs text-red-400 hover:text-red-300 font-bold underline"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                    )}

                    {filteredHistory.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-500">Nenhum checklist encontrado {historySearchFilter || historyDateFilter ? 'com estes filtros' : ''}.</p>
                        </div>
                    )}
                    
                    {filteredHistory.map(chk => (
                        <div key={chk.id} className="bg-secondary p-4 rounded-xl border border-gray-800 flex justify-between items-center group hover:border-gray-600 transition-colors">
                            <div className="flex-1">
                                <h4 className="text-white font-medium">{chk.template_nome}</h4>
                                <p className="text-sm text-gray-400">{chk.obra_nome || 'Obra não id.'} • {new Date(chk.data_referencia).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full mb-1">
                                        CONCLUÍDO
                                    </span>
                                    <span className="text-xs text-gray-500">{chk.responsavel_nome}</span>
                                </div>
                                {user?.role === 'admin' && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleViewDetails(chk)}
                                            className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-colors border border-primary/30"
                                            title="Ver Respostas"
                                        >
                                            <Eye size={20} />
                                        </button>
                                        <button 
                                            onClick={(e) => requestDeleteChecklist(chk.id, e)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/30"
                                            title="Excluir Checklist"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'templates' && (
                <div className="space-y-4">
                    <div className="hidden md:flex justify-end">
                        <button onClick={() => openBuilder()} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">
                            <Plus size={20} /> Criar Novo Modelo
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-secondary p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                                <div>
                                    <h4 className="text-white font-bold text-lg">{tpl.nome}</h4>
                                    <p className="text-gray-400 text-sm">{tpl.descricao}</p>
                                    <p className="text-gray-500 text-xs mt-1">{tpl.itens.length} itens configurados</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openBuilder(tpl)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg">
                                        <Settings size={20} />
                                    </button>
                                    <button onClick={() => requestDeleteTemplate(tpl.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
      )}

      {/* Modal: View Checklist Details (Admin) */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalhes do Checklist">
        <div className="space-y-4">
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Obra</p>
                        <p className="text-white font-medium">{viewingChecklist?.obra_nome}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Responsável</p>
                        <p className="text-white font-medium">{viewingChecklist?.responsavel_nome}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Data</p>
                        <p className="text-white font-medium">{viewingChecklist ? new Date(viewingChecklist.data_referencia).toLocaleDateString() : ''}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Modelo</p>
                        <p className="text-white font-medium">{viewingChecklist?.template_nome}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {viewingTemplate ? (
                    viewingTemplate.itens.map((item) => {
                        const answer = viewingChecklist?.respostas?.[item.id];
                        const obs = viewingChecklist?.respostas?.[`${item.id}_obs`];
                        
                        return (
                            <div key={item.id} className="border-b border-gray-800 pb-3 last:border-0">
                                <p className="text-gray-300 text-sm mb-1">{item.titulo}</p>
                                <div className="font-medium text-white">
                                    {item.tipo_campo === 'boolean' ? (
                                        answer === true ? 
                                            <span className="flex items-center gap-1 text-success"><Check size={16} /> Sim / OK</span> : 
                                            <span className="flex items-center gap-1 text-error"><X size={16} /> Não / Ruim</span>
                                    ) : (
                                        <span>{answer?.toString() || '-'}</span>
                                    )}
                                </div>
                                {obs && (
                                    <div className="mt-1 flex items-start gap-1 text-xs text-yellow-400/90 italic bg-yellow-400/10 p-2 rounded">
                                        <MessageSquare size={12} className="shrink-0 mt-0.5" />
                                        <span>Obs: {obs}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p className="text-gray-500 italic">Modelo original não encontrado. As perguntas podem ter sido alteradas.</p>
                )}
            </div>
            
            <button onClick={() => setIsViewModalOpen(false)} className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium">
                Fechar
            </button>
        </div>
      </Modal>

      {/* Modal: Project Selection */}
      <Modal isOpen={isProjectSelectOpen} onClose={() => setIsProjectSelectOpen(false)} title="Selecione a Obra">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {availableProjects.length === 0 ? (
                <div className="text-center text-gray-400 py-8 bg-gray-900 rounded-lg border border-dashed border-gray-700">
                    <Briefcase className="mx-auto mb-2 text-gray-600" size={32} />
                    <p>Você não está vinculado a nenhuma obra ativa.</p>
                </div>
            ) : (
                availableProjects.map(p => (
                    <button
                        key={p.id}
                        onClick={() => confirmProjectSelection(p)}
                        className="w-full text-left p-4 bg-gray-800 rounded-lg hover:bg-gray-700 border border-gray-700 flex items-center gap-3 group"
                    >
                        <Briefcase className="text-primary group-hover:scale-110 transition-transform" size={20} />
                        <div>
                            <p className="font-bold text-white">{p.nome}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{p.cliente_nome}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border border-gray-600 ${p.status === 'planejamento' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                    {p.status === 'planejamento' ? 'PLANEJ.' : 'ANDAMENTO'}
                                </span>
                            </div>
                        </div>
                    </button>
                ))
            )}
        </div>
      </Modal>

      {/* Modal: Builder */}
      <Modal isOpen={isBuilderOpen} onClose={() => setIsBuilderOpen(false)} title={editingTemplate.id ? "Editar Modelo" : "Novo Modelo"} maxWidth="2xl">
        <form onSubmit={saveTemplate} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Checklist</label>
                    <input type="text" required value={editingTemplate.nome} onChange={e => setEditingTemplate(prev => ({...prev, nome: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
                    <input type="text" value={editingTemplate.descricao} onChange={e => setEditingTemplate(prev => ({...prev, descricao: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                </div>
            </div>
            <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-semibold">Itens do Checklist</h4>
                    <button type="button" onClick={addBuilderItem} className="text-primary text-sm font-medium flex items-center hover:text-orange-400">
                        <Plus size={16} className="mr-1" /> Adicionar Item
                    </button>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                    {editingTemplate.itens?.map((item, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex gap-3 items-start">
                            <div className="mt-3 text-gray-500"><GripVertical size={16} /></div>
                            <div className="flex-1 space-y-2">
                                <input type="text" value={item.titulo} onChange={e => updateBuilderItem(idx, 'titulo', e.target.value)} className="w-full bg-transparent border-b border-gray-600 focus:border-primary text-white text-sm pb-1 outline-none" placeholder="Pergunta / Item" />
                                <div className="flex gap-2">
                                    <select value={item.tipo_campo} onChange={e => updateBuilderItem(idx, 'tipo_campo', e.target.value)} className="bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1">
                                        <option value="boolean">Sim/Não</option>
                                        <option value="text">Texto</option>
                                        <option value="number">Número</option>
                                        <option value="options">Opções</option>
                                    </select>
                                    <label className="flex items-center text-xs text-gray-400 gap-1 cursor-pointer">
                                        <input type="checkbox" checked={item.obrigatorio} onChange={e => updateBuilderItem(idx, 'obrigatorio', e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-primary focus:ring-primary" />
                                        Obrigatório
                                    </label>
                                </div>
                            </div>
                            <button type="button" onClick={() => removeBuilderItem(idx)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsBuilderOpen(false)} className="flex-1 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors font-bold flex items-center justify-center gap-2"><Save size={18} /> Salvar</button>
            </div>
        </form>
      </Modal>

      {/* Delete Template Modal */}
      <Modal isOpen={isDeleteTemplateModalOpen} onClose={() => setIsDeleteTemplateModalOpen(false)} title="Excluir Modelo" maxWidth="sm">
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Excluir este Modelo?</h3>
              <p className="text-sm text-gray-400 mb-6">
                  Esta ação não pode ser desfeita. Checklists antigos baseados neste modelo podem ficar sem referência.
              </p>
              <div className="flex gap-3">
                  <button onClick={() => setIsDeleteTemplateModalOpen(false)} className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700">Cancelar</button>
                  <button onClick={confirmDeleteTemplate} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">Excluir</button>
              </div>
          </div>
      </Modal>

      {/* Delete Checklist History Modal */}
      <Modal isOpen={isDeleteChecklistModalOpen} onClose={() => setIsDeleteChecklistModalOpen(false)} title="Excluir Checklist" maxWidth="sm">
          <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                  <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Excluir Registro?</h3>
              <p className="text-sm text-gray-400 mb-6">
                  Esta ação apagará permanentemente este checklist do histórico.
              </p>
              <div className="flex gap-3">
                  <button onClick={() => setIsDeleteChecklistModalOpen(false)} className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700">Cancelar</button>
                  <button onClick={confirmDeleteChecklist} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">Excluir</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default Checklists;
