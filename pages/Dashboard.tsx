
import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import { AlertTriangle, CheckCircle, TrendingUp, DollarSign, Wallet, Activity, PieChart as PieIcon, Users, Calendar } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { FinanceEntry } from '../types';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Metrics State
  const [metrics, setMetrics] = useState({
    activeProjects: 0,
    completedChecklists: 0,
    pendingChecklists: 0,
    totalSpent: 0, // Admin only
    totalBudget: 0, // Admin only
    totalReceivable: 0, // Admin only
    totalReceived: 0 // Admin only
  });
  
  // Chart Data State
  const [expensesByCategory, setExpensesByCategory] = useState<{name: string, value: number}[]>([]);
  const [rawFinanceEntries, setRawFinanceEntries] = useState<FinanceEntry[]>([]);
  const [activeProjectIds, setActiveProjectIds] = useState<string[]>([]); // New state for chart filtering
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  const [loading, setLoading] = useState(true);

  // Reminder Modal State
  const [showReminder, setShowReminder] = useState(false);

  // Colors for Pie Chart
  const COLORS = ['#FF7A00', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // 1. Projects Count & Financials
        let activeProjectsCount = 0;
        let activeIds: string[] = [];
        
        if (user?.role === 'eletricista') {
             // Eletricista: Busca apenas suas obras ativas via tabela de equipe
             const { data: teams } = await supabase
                .from('project_team')
                .select('project_id')
                .eq('user_id', user.id);
             
             if (teams && teams.length > 0) {
                 const ids = teams.map(t => t.project_id);
                 const { data: projs } = await supabase
                    .from('projects')
                    .select('*')
                    .in('id', ids);
                 
                 if (projs) {
                     // Considera ativas: planejamento e em_andamento
                     const activeProjs = projs.filter(p => ['em_andamento', 'planejamento'].includes(p.status));
                     activeProjectsCount = activeProjs.length;
                     activeIds = activeProjs.map(p => p.id);
                 }
             }
        } else {
             // Admin / Global View
             const { data: allProjects } = await supabase
                .from('projects')
                .select('*');
             
             const projects = allProjects || [];
             
             // Filtra apenas ativas para o Card de "Obras Ativas" (Visual)
             activeProjectsCount = projects.filter(p => ['em_andamento', 'planejamento'].includes(p.status)).length;
             
             // Define IDs "Ativos" para fins financeiros (exclui Concluído)
             activeIds = projects
                .filter(p => p.status !== 'concluido')
                .map(p => p.id);
             
             setActiveProjectIds(activeIds);
             
             // Calculate Totals for Admin
             if (user?.role === 'admin') {
                 // Fetch ALL finance entries
                 const { data: allFinance } = await supabase
                    .from('finance_entries')
                    .select('*')
                    .order('data', { ascending: true });
                
                 if (allFinance) {
                     setRawFinanceEntries(allFinance as FinanceEntry[]);

                     // 1. Total Recebido: APENAS de Obras Ativas (exclui concluídas)
                     const totalIncomeActive = allFinance
                        .filter(i => i.tipo === 'receita' && activeIds.includes(i.obra_id))
                        .reduce((acc, i) => acc + Number(i.valor), 0);
                     
                     metrics.totalReceived = totalIncomeActive;

                     // 2. Saldo a Receber: De TODAS as obras (incluindo concluídas)
                     let totalReceivableCalc = 0;
                     projects.forEach(p => {
                         const contract = Number(p.valor_contrato || 0);
                         const receivedForP = allFinance
                            .filter(i => i.tipo === 'receita' && i.obra_id === p.id)
                            .reduce((acc, i) => acc + Number(i.valor), 0);
                         
                         totalReceivableCalc += (contract - receivedForP);
                     });
                     
                     metrics.totalReceivable = totalReceivableCalc;
                 }
             }
        }

        // 2. Checklists Logic
        const today = new Date().toISOString().split('T')[0];
        
        let checklistQuery = supabase
          .from('checklists')
          .select('responsavel_id')
          .eq('status', 'concluido')
          .gte('created_at', `${today}T00:00:00`);
        
        if (user?.role === 'eletricista') {
            checklistQuery = checklistQuery.eq('responsavel_id', user.id);
        }

        const { data: doneChecklists } = await checklistQuery;
        const doneCount = doneChecklists?.length || 0;
        
        let pendingCount = 0;
        if (user?.role === 'admin') {
            const { data: electricians } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'eletricista');
            
            if (electricians) {
                const doneIds = doneChecklists?.map(c => c.responsavel_id) || [];
                pendingCount = electricians.filter(e => !doneIds.includes(e.id)).length;
            }
        } else if (user?.role === 'eletricista') {
            pendingCount = doneCount > 0 ? 0 : 1;
        }

        // 3. Reminder Logic for Electricians
        if (user?.role === 'eletricista' && activeProjectsCount > 0 && doneCount === 0) {
            // Check session storage to avoid showing it multiple times per session
            const hasSeenReminder = sessionStorage.getItem('checklistReminderSeen');
            if (!hasSeenReminder) {
                setShowReminder(true);
                sessionStorage.setItem('checklistReminderSeen', 'true');
            }
        }

        // 3. Expenses Aggregation (Admin Only)
        let spent = 0;
        let budget = 0;
        let categoryMap: Record<string, number> = {};
        
        if (user?.role === 'admin') {
           const { data: materialsData } = await supabase
             .from('project_materials')
             .select('valor_estimado, quantidade, project_id');

           const financeData = rawFinanceEntries.length > 0 ? rawFinanceEntries : (await supabase.from('finance_entries').select('*')).data || [];

           if (financeData) {
             financeData.forEach((item: any) => {
                 if (!activeIds.includes(item.obra_id)) return;
                 const val = Number(item.valor);
                 if (item.tipo === 'despesa') {
                     spent += val;
                     const cat = item.categoria || 'Outros';
                     categoryMap[cat] = (categoryMap[cat] || 0) + val;
                 }
             });
           }
           
           if (materialsData) {
             budget = materialsData
                .filter((m: any) => activeIds.includes(m.project_id))
                .reduce((acc: number, curr: any) => acc + (Number(curr.valor_estimado) * Number(curr.quantidade)), 0);
           }
        }

        setMetrics(prev => ({
          ...prev,
          activeProjects: activeProjectsCount || 0,
          completedChecklists: doneCount,
          pendingChecklists: pendingCount,
          totalSpent: spent,
          totalBudget: budget
        }));

        const pieData = Object.keys(categoryMap).map(key => ({
            name: key,
            value: categoryMap[key]
        }));
        setExpensesByCategory(pieData);

      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
        fetchMetrics();
    }
  }, [user, rawFinanceEntries.length]);

  // --- Process Chart Data based on Time Range ---
  const financialFlow = useMemo(() => {
      if (!rawFinanceEntries.length) return [];

      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
          case '7d': startDate.setDate(now.getDate() - 7); break;
          case '30d': startDate.setDate(now.getDate() - 30); break;
          case '90d': startDate.setDate(now.getDate() - 90); break;
          case 'all': startDate = new Date('2000-01-01'); break;
      }

      const groupedData: Record<string, { entrada: number, saida: number }> = {};
      
      rawFinanceEntries.forEach(entry => {
          if (!activeProjectIds.includes(entry.obra_id)) return;
          const entryDate = new Date(entry.data);
          const dateKey = entry.data;

          if (entryDate >= startDate) {
              if (!groupedData[dateKey]) groupedData[dateKey] = { entrada: 0, saida: 0 };
              
              if (entry.tipo === 'receita') {
                  groupedData[dateKey].entrada += Number(entry.valor);
              } else {
                  groupedData[dateKey].saida += Number(entry.valor);
              }
          }
      });

      const sortedKeys = Object.keys(groupedData).sort();
      return sortedKeys.map(key => {
          const dateParts = key.split('-');
          return {
              name: `${dateParts[2]}/${dateParts[1]}`, // DD/MM
              fullDate: key,
              entrada: groupedData[key].entrada,
              saida: groupedData[key].saida
          };
      });
  }, [rawFinanceEntries, timeRange, activeProjectIds]);


  const Card = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
        <p className="text-2xl md:text-3xl font-bold text-white">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-full ${colorClass} bg-opacity-20`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
             Olá, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-400">Visão geral do sistema</p>
        </div>
        <span className="text-sm text-gray-400 bg-secondary px-3 py-1 rounded-full border border-gray-700">
            {new Date().toLocaleDateString('pt-BR')}
        </span>
      </div>

      {/* ADMIN FINANCIAL VIEW */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
             <div className="bg-gradient-to-r from-gray-900 to-secondary p-6 rounded-xl border border-gray-700 relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Total Recebido (Ativas)</p>
                    <h3 className="text-3xl font-bold text-green-500">R$ {metrics.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <p className="text-xs text-gray-500 mt-1">Apenas obras em andamento/planej.</p>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 opacity-10">
                    <DollarSign size={80} />
                </div>
            </div>
             <div className="bg-gradient-to-r from-gray-900 to-secondary p-6 rounded-xl border border-gray-700 relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Saldo a Receber</p>
                    <h3 className="text-3xl font-bold text-orange-400">R$ {metrics.totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <p className="text-xs text-gray-500 mt-1">Inclui pendências de concluídas</p>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 opacity-10">
                    <TrendingUp size={80} />
                </div>
            </div>
            <div className="bg-gradient-to-r from-gray-900 to-secondary p-6 rounded-xl border border-gray-700 relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Total de Despesas (Ativas)</p>
                    <h3 className="text-3xl font-bold text-red-400">R$ {metrics.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <p className="text-xs text-gray-500 mt-1">Apenas obras em andamento/planej.</p>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 opacity-10">
                    <Wallet size={80} />
                </div>
            </div>
        </div>
      )}

      {/* OPERATIONAL METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
            title="Obras Ativas" 
            value={metrics.activeProjects} 
            icon={TrendingUp} 
            colorClass="text-primary bg-primary" 
        />
        <Card 
            title="Checklists Pendentes (Hoje)" 
            value={metrics.pendingChecklists} 
            subtitle={user?.role === 'admin' ? "Eletricistas que não enviaram" : "Seu checklist diário"}
            icon={AlertTriangle} 
            colorClass={metrics.pendingChecklists > 0 ? "text-alert bg-alert" : "text-gray-500 bg-gray-500"} 
        />
        <Card 
            title="Checklists Realizados (Hoje)" 
            value={metrics.completedChecklists} 
            icon={CheckCircle} 
            colorClass="text-success bg-success" 
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Financial Flow Chart */}
        {user?.role === 'admin' && (
            <div className="lg:col-span-2 bg-secondary p-6 rounded-xl border border-gray-800 flex flex-col">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <DollarSign className="text-green-500" size={20} />
                        <h3 className="text-lg font-bold text-white">Fluxo Financeiro (Obras Ativas)</h3>
                    </div>
                    
                    <div className="flex bg-gray-900 rounded-lg p-1">
                        <button onClick={() => setTimeRange('7d')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === '7d' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>7D</button>
                        <button onClick={() => setTimeRange('30d')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === '30d' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>30D</button>
                        <button onClick={() => setTimeRange('90d')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === '90d' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>90D</button>
                         <button onClick={() => setTimeRange('all')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Todos</button>
                    </div>
                </div>

                <div className="flex-1 min-h-[300px]">
                    {financialFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={financialFlow}>
                                <defs>
                                    <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1F2933', borderColor: '#374151', color: '#fff' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, '']}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]) return payload[0].payload.fullDate.split('-').reverse().join('/');
                                        return label;
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="entrada" name="Recebido" stroke="#10B981" fillOpacity={1} fill="url(#colorEntrada)" strokeWidth={2} />
                                <Area type="monotone" dataKey="saida" name="Despesas" stroke="#EF4444" fillOpacity={1} fill="url(#colorSaida)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                             <Calendar size={48} className="mb-2 opacity-50" />
                             <p>Sem dados financeiros para o período.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* Expenses Pie Chart (Admin Only) or Alerts */}
        {user?.role === 'admin' ? (
             <div className="bg-secondary p-6 rounded-xl border border-gray-800 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">Despesas (Obras Ativas)</h3>
                    <PieIcon className="text-gray-500" size={20} />
                </div>
                <div className="flex-1 min-h-[250px] relative">
                    {expensesByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={expensesByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {expensesByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1F2933', borderColor: '#374151', color: '#fff' }} 
                                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
                                />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            Sem dados de despesas.
                        </div>
                    )}
                </div>
             </div>
        ) : (
             <div className="lg:col-span-3 bg-secondary p-6 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">Avisos do Sistema</h3>
                <div className="space-y-4">
                    <div className="flex items-start p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Users className="text-blue-400 shrink-0 mr-3" size={20} />
                        <div>
                            <p className="text-sm font-bold text-blue-400">Bem vindo, {user?.name}</p>
                            <p className="text-xs text-gray-400 mt-1">Verifique suas tarefas diárias na aba Checklists.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Reminder Modal for Electricians */}
      <Modal 
        isOpen={showReminder} 
        onClose={() => setShowReminder(false)} 
        title="Lembrete Diário"
        maxWidth="sm"
      >
          <div className="text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 mb-4 animate-bounce">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Checklist Pendente</h3>
              <p className="text-gray-300 mb-6 px-2">
                  Você ainda não enviou o checklist de suas obras hoje. Mantenha o diário de obra atualizado!
              </p>
              <button 
                onClick={() => navigate('/checklists')}
                className="w-full rounded-xl bg-primary px-4 py-3 text-white font-bold hover:bg-orange-600 shadow-lg transition-transform active:scale-95"
              >
                Ir para Checklists
              </button>
              <button 
                onClick={() => setShowReminder(false)}
                className="mt-3 text-sm text-gray-500 hover:text-white"
              >
                Lembrar mais tarde
              </button>
          </div>
      </Modal>

    </div>
  );
};

export default Dashboard;
