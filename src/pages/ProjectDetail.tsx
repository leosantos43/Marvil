
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Project, Expense, Material, Profile, ProjectDocument } from '../types';
import { Chat } from '../components/Chat';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DollarSign, Upload, FileText, Check, X, Plus, Users, Trash2, TrendingUp, TrendingDown, Folder, Paperclip, Download, Camera } from 'lucide-react';

type Tab = 'overview' | 'finance' | 'team' | 'materials' | 'expenses' | 'documents' | 'chat';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Team Management State
  const [assignedTeam, setAssignedTeam] = useState<Profile[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  // Expense State
  const [newExpense, setNewExpense] = useState({ type: 'alimentacao', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [uploading, setUploading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editExpenseAmount, setEditExpenseAmount] = useState('');

  // Documents State
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');

  // Material State
  const [newMaterial, setNewMaterial] = useState({ description: '', quantity: '', unit_price: '' });

  const isAdmin = profile?.role === 'admin';
  const isEmployee = profile?.role === 'funcionario';
  const isClient = profile?.role === 'cliente';

  useEffect(() => {
    if (id) {
      fetchProjectData();
      if (isAdmin) fetchAvailableUsers();
    }
  }, [id]);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      // SECURITY: Conditionally select fields based on role
      // Employees should NEVER download total_value or amount_received
      let selectQuery = 'id, name, address, city, start_date, end_date_prediction, status, description, created_at, client_id, client:responsaveis(*)';
      
      if (isAdmin) {
        selectQuery += ', total_value, amount_received';
      }

      const { data: proj, error } = await supabase.from('obras').select(selectQuery).eq('id', id).single();
      if (error) throw error;
      // Ensure unknown first to allow partial type casting
      setProject(proj as unknown as Project);

      // Fetch Team Members
      const { data: assignments } = await supabase
        .from('obra_funcionarios')
        .select('user:users_profiles(*)')
        .eq('project_id', id);
      
      if (assignments) {
        setAssignedTeam(assignments.map((a: any) => a.user).filter(Boolean));
      }

      if (!isClient) {
        // Fetch Materials
        const { data: mats } = await supabase.from('materiais_obra').select('*').eq('obra_id', id);
        setMaterials(mats || []);

        // Fetch Expenses (Admin sees all, Employee sees theirs)
        let expenseQuery = supabase.from('gastos').select('*, profile:users_profiles(*)').eq('project_id', id).order('date', { ascending: false });
        if (isEmployee) {
          // Employees can only see their own expenses
          expenseQuery = expenseQuery.eq('user_id', profile?.id);
        }
        const { data: exps } = await expenseQuery;
        setExpenses(exps || []);

        // Fetch Documents (Admin Only)
        if (isAdmin) {
           const { data: docs } = await supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false });
           setDocuments(docs || []);
        }
      }
    } catch (err: any) {
      console.error("Error fetching project data:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    const { data } = await supabase.from('users_profiles').select('*').eq('role', 'funcionario').eq('active', true);
    setAvailableUsers(data || []);
  };

  // --- EXPORT DATA ---
  const handleExportCSV = () => {
    if (!expenses.length) return alert("Sem dados para exportar.");
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Data,Funcionario,Tipo,Valor,Status,Descricao\n"
        + expenses.map(e => {
            return `${e.date},"${e.profile?.full_name || 'N/A'}",${e.type},${e.amount},${e.status},"${e.description || ''}"`;
        }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extrato_obra_${project?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- TEAM ACTIONS ---
  const handleAddTeamMember = async () => {
    if (!selectedUserToAdd || !isAdmin) return;
    try {
      await supabase.from('obra_funcionarios').insert({ project_id: id, user_id: selectedUserToAdd });
      await supabase.from('audit_logs').insert({ user_id: profile?.id, action: 'TEAM_ADD', details: `Adicionou usuário na obra ${project?.name}` });
      setSelectedUserToAdd('');
      fetchProjectData();
    } catch (err) { alert('Erro ao adicionar membro.'); }
  };

  const handleRemoveTeamMember = async (userId: string) => {
    if (!isAdmin) return;
    if (!confirm('Remover funcionário da equipe desta obra?')) return;
    if (!id) return;
    
    // Optimistic Update (Remove from UI immediately)
    setAssignedTeam(prev => prev.filter(u => u.id !== userId));

    try {
      // Explicitly targeting the junction table
      const { error } = await supabase
        .from('obra_funcionarios')
        .delete()
        .eq('project_id', id)
        .eq('user_id', userId);
        
      if (error) {
        console.error("Supabase DELETE error:", error);
        // Revert UI if failed
        fetchProjectData(); 
        alert(`Erro ao remover membro: ${error.message}`);
      } else {
        // Log success
        await supabase.from('audit_logs').insert({ 
          user_id: profile?.id, 
          action: 'TEAM_REMOVE', 
          details: `Removeu usuário ${userId} da obra ${project?.name}` 
        });
      }
    } catch (err: any) {
      console.error("Catch error:", err);
      fetchProjectData();
    }
  };

  // --- EXPENSE ACTIONS ---
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setUploading(true);

    try {
      let publicUrl = null;

      // Upload File (Optional)
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage.from('comprovantes').upload(filePath, receiptFile);
        if (uploadError) throw uploadError;

        const { data: { publicUrl: url } } = supabase.storage.from('comprovantes').getPublicUrl(filePath);
        publicUrl = url;
      }

      // Insert Record
      await supabase.from('gastos').insert({
        project_id: id,
        user_id: profile.id,
        type: newExpense.type,
        amount: parseFloat(newExpense.amount),
        date: newExpense.date,
        description: newExpense.description,
        receipt_url: publicUrl, // Can be null
        status: 'pendente'
      });

      await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'EXPENSE_ADD', details: `Gasto R$${newExpense.amount} em ${project?.name}` });

      alert('Gasto registrado com sucesso!');
      setNewExpense({ type: 'alimentacao', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setReceiptFile(null);
      fetchProjectData();
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleExpenseAction = async (expenseId: string, status: 'aprovado' | 'rejeitado') => {
    if (!isAdmin) return;
    await supabase.from('gastos').update({ status }).eq('id', expenseId);
    fetchProjectData();
  };

  const handleUpdateExpenseAmount = async (expenseId: string) => {
     if (!isAdmin || !editExpenseAmount) return;
     await supabase.from('gastos').update({ amount: parseFloat(editExpenseAmount) }).eq('id', expenseId);
     setEditingExpense(null);
     setEditExpenseAmount('');
     fetchProjectData();
  };

  // --- MATERIAL ACTIONS ---
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    await supabase.from('materiais_obra').insert({
      obra_id: id,
      description: newMaterial.description,
      quantity: parseInt(newMaterial.quantity),
      unit_price: parseFloat(newMaterial.unit_price)
    });
    setNewMaterial({ description: '', quantity: '', unit_price: '' });
    fetchProjectData();
  };

  const handleDeleteMaterial = async (matId: string) => {
    if (!isAdmin || !confirm('Deletar material?')) return;
    await supabase.from('materiais_obra').delete().eq('id', matId);
    fetchProjectData();
  };

  // --- DOCUMENT ACTIONS ---
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !docName || !isAdmin) return;
    setUploading(true);

    try {
      // Ensure bucket exists manually (instruction already given), fallback catch
      const fileExt = docFile.name.split('.').pop();
      const fileName = `doc_${Math.random()}.${fileExt}`;
      const filePath = `${id}/${fileName}`;

      const { error: upError } = await supabase.storage.from('project-files').upload(filePath, docFile);
      if (upError) throw upError;
      
      const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(filePath);

      await supabase.from('project_documents').insert({
         project_id: id,
         name: docName,
         url: publicUrl,
         type: fileExt
      });

      setDocFile(null);
      setDocName('');
      fetchProjectData();
    } catch (err: any) {
       alert('Erro ao enviar documento. Verifique se o bucket "project-files" existe e é público.' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Calculations (Admin Only safe)
  const totalMaterialsCost = isAdmin ? materials.reduce((acc, m) => acc + (m.quantity * m.unit_price), 0) : 0;
  const totalExpensesApproved = expenses.filter(e => e.status === 'aprovado').reduce((acc, e) => acc + e.amount, 0);
  const totalProjectValue = project?.total_value || 0;
  const totalReceived = project?.amount_received || 0;
  const totalReceivable = totalProjectValue - totalReceived;
  const estimatedProfit = totalProjectValue - totalMaterialsCost - totalExpensesApproved;

  if (loading) return <div className="text-center py-10 text-gray-500">Carregando detalhes...</div>;
  if (!project) return <div className="text-center py-10 text-red-500">Acesso Negado.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Users size={100} className="text-marvil-orange" />
        </div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">{project.name}</h1>
            <p className="text-gray-400 flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${project.status === 'aberta' ? 'bg-green-900/50 text-green-500' : project.status === 'pausada' ? 'bg-yellow-900/50 text-yellow-500' : 'bg-blue-900/50 text-blue-500'}`}>
                {project.status}
              </span>
              <span>{project.address}, {project.city}</span>
            </p>
          </div>
          {isAdmin && project.status === 'aberta' && (
            <Button variant="danger" onClick={async () => {
               if(confirm('Tem certeza que deseja encerrar esta obra?')) {
                 await supabase.from('obras').update({status: 'concluida'}).eq('id', project.id);
                 fetchProjectData();
               }
            }}>Encerrar Obra</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-marvil-border gap-2">
        {(['overview', 'finance', 'team', 'materials', 'expenses', 'documents', 'chat'] as Tab[]).map(tab => {
          if (isClient && !['overview', 'documents'].includes(tab)) return null;
          if (!isAdmin && tab === 'finance') return null;
          if (!isAdmin && tab === 'documents') return null;
          
          const labels = {
             overview: 'Visão Geral',
             finance: 'Financeiro',
             team: 'Equipe',
             materials: 'Materiais',
             expenses: 'Gastos',
             documents: 'Documentos',
             chat: 'Chat Obra'
          };

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-marvil-orange text-white bg-white/5' : 'text-gray-400 hover:text-gray-300'}`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
             <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
               <h3 className="text-lg font-bold text-white mb-4">Detalhes do Projeto</h3>
               <div className="space-y-3">
                 <p><strong className="text-gray-500 uppercase text-xs block">Cliente</strong> {project.client?.name}</p>
                 <p><strong className="text-gray-500 uppercase text-xs block">Telefone</strong> {project.client?.phone || '-'}</p>
                 <p><strong className="text-gray-500 uppercase text-xs block">Início / Fim</strong> {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date_prediction).toLocaleDateString()}</p>
                 <div className="pt-4 border-t border-marvil-border">
                   <strong className="text-gray-500 uppercase text-xs block mb-1">Descrição</strong>
                   <p className="text-sm">{project.description || 'Sem descrição.'}</p>
                 </div>
               </div>
             </div>
             <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-4">Equipe Vinculada</h3>
                <div className="flex flex-wrap gap-2">
                  {assignedTeam.map(member => (
                    <div key={member.id} className="flex items-center gap-2 bg-marvil-dark border border-marvil-border px-3 py-2 rounded-full">
                      <div className="w-6 h-6 bg-marvil-orange rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {member.full_name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-300">{member.full_name}</span>
                    </div>
                  ))}
                  {assignedTeam.length === 0 && <p className="text-gray-500 text-sm">Nenhum membro vinculado.</p>}
                </div>
             </div>
           </div>
        )}

        {/* FINANCE (Admin Only) */}
        {activeTab === 'finance' && isAdmin && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
                    <div className="flex items-center gap-3 mb-2 text-blue-500"><DollarSign size={20} /> <h4 className="font-bold uppercase text-sm">Valor do Projeto</h4></div>
                    <p className="text-3xl font-bold text-white">R$ {totalProjectValue.toFixed(2)}</p>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between border-t border-white/10 pt-2">
                      <span className="text-green-500 font-semibold">Recebido: R$ {totalReceived.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex justify-between">
                      <span className="text-yellow-500 font-semibold">A Receber: R$ {totalReceivable.toFixed(2)}</span>
                    </div>
                 </div>
                 <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
                    <div className="flex items-center gap-3 mb-2 text-red-500"><TrendingDown size={20} /> <h4 className="font-bold uppercase text-sm">Custos Totais</h4></div>
                    <p className="text-3xl font-bold text-white">R$ {(totalMaterialsCost + totalExpensesApproved).toFixed(2)}</p>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                      <span>Materiais: R$ {totalMaterialsCost.toFixed(2)}</span>
                      <span>Equipe: R$ {totalExpensesApproved.toFixed(2)}</span>
                    </div>
                 </div>
                 <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
                    <div className="flex items-center gap-3 mb-2 text-green-500"><TrendingUp size={20} /> <h4 className="font-bold uppercase text-sm">Lucro Estimado</h4></div>
                    <p className="text-3xl font-bold text-white">R$ {estimatedProfit.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">Margem: {totalProjectValue > 0 ? ((estimatedProfit / totalProjectValue) * 100).toFixed(1) : 0}%</p>
                 </div>
              </div>
           </div>
        )}

        {/* TEAM */}
        {activeTab === 'team' && (isAdmin || isEmployee) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {isAdmin && (
              <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-4">Adicionar Funcionário</h3>
                <div className="flex gap-2">
                  <select className="flex-1 bg-marvil-dark border border-marvil-border rounded px-4 py-2 text-white outline-none" value={selectedUserToAdd} onChange={(e) => setSelectedUserToAdd(e.target.value)}>
                    <option value="">Selecione...</option>
                    {availableUsers.filter(u => !assignedTeam.find(m => m.id === u.id)).map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
                  </select>
                  <Button onClick={handleAddTeamMember} disabled={!selectedUserToAdd}><Plus size={20} /></Button>
                </div>
              </div>
            )}
            <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
               <h3 className="text-lg font-bold text-white mb-4">Membros ({assignedTeam.length})</h3>
               <div className="space-y-3">
                 {assignedTeam.map(member => (
                   <div key={member.id} className="flex justify-between bg-marvil-dark p-3 rounded border border-marvil-border items-center">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">{member.full_name.charAt(0)}</div>
                        <span className="text-white font-semibold">{member.full_name}</span>
                     </div>
                     {isAdmin && <button onClick={() => handleRemoveTeamMember(member.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* MATERIALS (Partial View for Employees) */}
        {activeTab === 'materials' && !isClient && (
          <div className="space-y-6">
             {isAdmin && (
                <form onSubmit={handleAddMaterial} className="bg-marvil-card border border-marvil-border p-4 rounded-lg flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Input label="Item" value={newMaterial.description} onChange={e => setNewMaterial({...newMaterial, description: e.target.value})} required />
                  </div>
                  <div className="w-24">
                    <Input label="Qtd" type="number" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value})} required />
                  </div>
                  <div className="w-32">
                    <Input label="Valor Un." type="number" step="0.01" value={newMaterial.unit_price} onChange={e => setNewMaterial({...newMaterial, unit_price: e.target.value})} required />
                  </div>
                  <Button type="submit" className="mb-0.5">Add</Button>
                </form>
             )}
             <div className="bg-marvil-card border border-marvil-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-marvil-dark text-gray-400 uppercase font-mono">
                  <tr>
                    <th className="p-4">Descrição</th>
                    <th className="p-4 text-center">Qtd</th>
                    {/* HIDE FINANCIAL COLUMNS FOR NON-ADMINS */}
                    {isAdmin && <th className="p-4 text-right">Valor Un.</th>}
                    {isAdmin && <th className="p-4 text-right">Total</th>}
                    {isAdmin && <th className="p-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-marvil-border">
                  {materials.map(m => (
                    <tr key={m.id} className="hover:bg-white/5">
                      <td className="p-4">{m.description}</td>
                      <td className="p-4 text-center">{m.quantity}</td>
                      {/* HIDE FINANCIAL VALUES FOR NON-ADMINS */}
                      {isAdmin && <td className="p-4 text-right">R$ {m.unit_price.toFixed(2)}</td>}
                      {isAdmin && <td className="p-4 text-right text-marvil-orange">R$ {(m.quantity * m.unit_price).toFixed(2)}</td>}
                      {isAdmin && (
                         <td className="p-4 text-center">
                            <button onClick={() => handleDeleteMaterial(m.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={16}/></button>
                         </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DOCUMENTS (Admin Only) */}
        {activeTab === 'documents' && isAdmin && (
           <div className="space-y-6">
              <form onSubmit={handleUploadDocument} className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Folder size={20} className="text-marvil-orange"/> Anexar Documento</h3>
                 <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                       <Input label="Nome do Arquivo" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Ex: Contrato, Planta Baixa" required />
                    </div>
                    <div className="w-full md:w-auto">
                       <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Arquivo</label>
                       <div className="relative">
                          <input type="file" id="doc-upload" className="hidden" onChange={e => setDocFile(e.target.files?.[0] || null)} required />
                          <label htmlFor="doc-upload" className="flex items-center justify-center px-4 py-2.5 border border-dashed border-gray-500 rounded hover:border-marvil-orange cursor-pointer text-sm text-gray-400 w-full md:w-48">
                             {docFile ? <span className="text-marvil-orange truncate">{docFile.name}</span> : <span className="flex gap-2"><Paperclip size={16}/> Selecionar</span>}
                          </label>
                       </div>
                    </div>
                    <Button type="submit" isLoading={uploading}>Upload</Button>
                 </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {documents.map(doc => (
                    <a key={doc.id} href={doc.url} target="_blank" className="bg-marvil-card border border-marvil-border p-4 rounded-lg hover:border-marvil-orange group flex items-center gap-3">
                       <div className="w-10 h-10 bg-marvil-dark rounded flex items-center justify-center text-gray-400 group-hover:text-marvil-orange">
                          <FileText size={20} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate">{doc.name}</p>
                          <p className="text-xs text-gray-500 uppercase">{doc.type}</p>
                       </div>
                    </a>
                 ))}
                 {documents.length === 0 && <p className="col-span-full text-center text-gray-500">Nenhum documento anexado.</p>}
              </div>
           </div>
        )}

        {/* EXPENSES (Admin sees all, Employee sees own) */}
        {activeTab === 'expenses' && !isClient && (
          <div className="space-y-6">
             <div className="flex justify-end">
                {isAdmin && (
                  <Button variant="secondary" size="sm" onClick={handleExportCSV}>
                    <Download size={16} className="mr-2" /> Exportar Relatório
                  </Button>
                )}
             </div>

             {(isEmployee || isAdmin) && (
               <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg border-marvil-orange/20">
                 <h3 className="text-lg font-bold text-white mb-4">Registrar Gasto</h3>
                 <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Tipo</label>
                       <div className="grid grid-cols-3 gap-2">
                          {['alimentacao', 'transporte', 'outros'].map(type => (
                            <button key={type} type="button" onClick={() => setNewExpense({...newExpense, type: type})} className={`py-2 rounded text-sm font-medium capitalize border ${newExpense.type === type ? 'bg-marvil-orange border-marvil-orange text-white' : 'bg-marvil-dark border-marvil-border text-gray-400'}`}>{type}</button>
                          ))}
                       </div>
                    </div>
                    <Input type="number" label="Valor" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required step="0.01" />
                    <Input type="date" label="Data" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} required />
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Comprovante (Opcional)</label>
                      <div className="relative">
                         <input 
                            type="file" 
                            id="expense-receipt"
                            accept="image/*" 
                            capture="environment" 
                            onChange={e => setReceiptFile(e.target.files?.[0] || null)} 
                            className="hidden" 
                         />
                         <label htmlFor="expense-receipt" className="flex items-center justify-center w-full px-4 py-2.5 bg-marvil-dark border border-marvil-border rounded cursor-pointer hover:border-marvil-orange transition-colors gap-2 text-sm text-gray-400">
                            <Camera size={16} />
                            {receiptFile ? <span className="text-marvil-orange truncate">{receiptFile.name}</span> : "Tirar foto / Escolher arquivo"}
                         </label>
                      </div>
                    </div>
                    
                    <Input className="col-span-full" label="Descrição" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} required />
                    <Button type="submit" className="col-span-full" isLoading={uploading}>Salvar Gasto</Button>
                 </form>
               </div>
             )}

             <div className="bg-marvil-card border border-marvil-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-marvil-dark text-gray-400 uppercase font-mono text-xs">
                    <tr>
                      <th className="p-4">Data</th>
                      <th className="p-4">Func.</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4 text-right">Valor</th>
                      <th className="p-4 text-center">Status</th>
                      {isAdmin && <th className="p-4 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-marvil-border">
                    {expenses.map(expense => (
                      <tr key={expense.id} className="hover:bg-white/5">
                        <td className="p-4 text-gray-300">{new Date(expense.date).toLocaleDateString().slice(0,5)}</td>
                        <td className="p-4 text-gray-300">{expense.profile?.full_name.split(' ')[0]}</td>
                        <td className="p-4 capitalize text-gray-400">{expense.type}</td>
                        <td className="p-4 text-right font-mono font-bold text-white">
                           {/* Value Visibility Logic */}
                           {(isAdmin || expense.user_id === profile?.id) ? (
                              editingExpense === expense.id ? (
                                <input 
                                  type="number" 
                                  className="w-20 bg-black border border-marvil-orange text-white px-1" 
                                  value={editExpenseAmount} 
                                  onChange={e => setEditExpenseAmount(e.target.value)}
                                  onBlur={() => handleUpdateExpenseAmount(expense.id)}
                                  onKeyDown={e => e.key === 'Enter' && handleUpdateExpenseAmount(expense.id)}
                                  autoFocus
                                />
                              ) : (
                                <span onClick={() => {
                                   if(isAdmin) {
                                     setEditingExpense(expense.id);
                                     setEditExpenseAmount(expense.amount.toString());
                                   }
                                }} className={isAdmin ? "cursor-pointer border-b border-dashed border-gray-600 hover:border-marvil-orange" : ""}>
                                   R$ {expense.amount.toFixed(2)}
                                </span>
                              )
                           ) : '---'}
                        </td>
                        <td className="p-4 text-center">
                           {expense.receipt_url && <a href={expense.receipt_url} target="_blank" className="mr-2 text-marvil-orange"><FileText size={14}/></a>}
                           <span className={`inline-block w-2 h-2 rounded-full ${expense.status === 'aprovado' ? 'bg-green-500' : expense.status === 'rejeitado' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        </td>
                        {isAdmin && (
                          <td className="p-4 flex justify-center gap-2">
                            <button onClick={() => handleExpenseAction(expense.id, 'aprovado')} className="text-green-500"><Check size={16} /></button>
                            <button onClick={() => handleExpenseAction(expense.id, 'rejeitado')} className="text-red-500"><X size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {/* CHAT */}
        {activeTab === 'chat' && !isClient && (
          <div className="h-[600px]">
            <Chat projectId={id!} userId={profile!.id} />
          </div>
        )}
      </div>
    </div>
  );
};
