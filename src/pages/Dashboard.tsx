
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { HardHat, DollarSign, CheckCircle, Clock, Activity, Users, PieChart as PieIcon, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '../components/ui/Button';

const COLORS = ['#FF6600', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const Dashboard: React.FC = () => {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState({
    activeProjects: 0,
    completedProjects: 0,
    pendingExpenses: 0,
    totalExpenses: 0,
    totalReceived: 0,
    totalReceivable: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (profile) fetchData();
    else if (!useAuthStore.getState().loading) {
      setLoading(false);
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch Projects Stats
      // Only Admins should pull financial columns to avoid RLS issues or unnecessary data transfer
      const selectQuery = isAdmin 
        ? 'status, total_value, amount_received' 
        : 'status';
        
      const { data: projectsData, error: projError } = await supabase.from('obras').select(selectQuery);
      
      if (projError) throw projError;
      
      // Cast to any[] to resolve TypeScript inference issues with dynamic select strings
      const projects = projectsData as any[];
      
      const active = projects?.filter((p: any) => p.status === 'aberta').length || 0;
      const completed = projects?.filter((p: any) => p.status === 'concluida').length || 0;

      let calculatedTotalReceived = 0;
      let calculatedTotalReceivable = 0;

      if (isAdmin && projects) {
         const totalContractValue = projects.reduce((acc: number, p: any) => acc + (p.total_value || 0), 0);
         calculatedTotalReceived = projects.reduce((acc: number, p: any) => acc + (p.amount_received || 0), 0);
         calculatedTotalReceivable = totalContractValue - calculatedTotalReceived;
      }

      // Fetch Expenses Stats
      let pendingExpensesCount = 0;
      let totalApprovedExpenses = 0;
      let expensesData: any[] = [];

      if (isAdmin) {
        const { data: expenses } = await supabase.from('gastos').select('*, profile:users_profiles(*)');
        if (expenses) {
            pendingExpensesCount = expenses.filter(e => e.status === 'pendente').length;
            totalApprovedExpenses = expenses.filter(e => e.status === 'aprovado').reduce((acc, curr) => acc + Number(curr.amount), 0);
            
            // Area Chart: Time evolution
            const grouped = expenses.reduce((acc: any, curr) => {
                const date = curr.date.split('T')[0];
                acc[date] = (acc[date] || 0) + Number(curr.amount);
                return acc;
            }, {});
            expensesData = Object.keys(grouped).map(key => ({ date: key, value: grouped[key] })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Pie Chart: By Category
            const byCategory = expenses.filter(e => e.status === 'aprovado').reduce((acc: any, curr) => {
              acc[curr.type] = (acc[curr.type] || 0) + Number(curr.amount);
              return acc;
            }, {});
            setCategoryData(Object.keys(byCategory).map(key => ({ name: key, value: byCategory[key] })));

            // Bar Chart: By Employee
            const byEmployee = expenses.filter(e => e.status === 'aprovado').reduce((acc: any, curr) => {
              const name = curr.profile?.full_name?.split(' ')[0] || 'Desc.';
              acc[name] = (acc[name] || 0) + Number(curr.amount);
              return acc;
            }, {});
            setEmployeeData(Object.keys(byEmployee).map(key => ({ name: key, valor: byEmployee[key] })));
        }
      } else {
          // Employee sees their own pending expenses
          const { count } = await supabase.from('gastos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').eq('user_id', profile!.id);
          pendingExpensesCount = count || 0;
      }

      setStats({
        activeProjects: active,
        completedProjects: completed,
        pendingExpenses: pendingExpensesCount,
        totalExpenses: totalApprovedExpenses,
        totalReceived: calculatedTotalReceived,
        totalReceivable: calculatedTotalReceivable
      });
      setChartData(expensesData);

    } catch (err: any) {
      console.error("Error fetching dashboard data", err);
      setError('Erro ao carregar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 animate-pulse">Carregando dados do sistema...</div>;
  
  if (error) return (
    <div className="p-10 text-center text-red-500 bg-marvil-card rounded border border-red-900">
      <p className="mb-4">{error}</p>
      <Button onClick={fetchData} variant="secondary">Tentar Novamente</Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Visão geral do sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg relative overflow-hidden group hover:border-marvil-orange/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium uppercase">Obras Ativas</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.activeProjects}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded text-blue-500 group-hover:text-white group-hover:bg-blue-500 transition-colors">
              <HardHat size={24} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500/30 group-hover:bg-blue-500 transition-colors"></div>
        </div>

        {isAdmin && (
          <>
            <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg relative overflow-hidden group hover:border-green-500/50 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm font-medium uppercase">Total Recebido</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceived)}
                  </h3>
                </div>
                <div className="p-3 bg-green-500/10 rounded text-green-500 group-hover:text-white group-hover:bg-green-500 transition-colors">
                  <Wallet size={24} />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-green-500/30 group-hover:bg-green-500 transition-colors"></div>
            </div>

            <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg relative overflow-hidden group hover:border-yellow-500/50 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm font-medium uppercase">A Receber</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceivable)}
                  </h3>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded text-yellow-500 group-hover:text-white group-hover:bg-yellow-500 transition-colors">
                  <TrendingUp size={24} />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-500/30 group-hover:bg-yellow-500 transition-colors"></div>
            </div>
          </>
        )}

        <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg relative overflow-hidden group hover:border-red-500/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium uppercase">{isAdmin ? 'Gastos Totais' : 'Seus Gastos Pendentes'}</p>
              <h3 className="text-2xl font-bold text-white mt-2">
                {isAdmin 
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalExpenses)
                  : stats.pendingExpenses
                }
              </h3>
            </div>
            <div className="p-3 bg-red-500/10 rounded text-red-500 group-hover:text-white group-hover:bg-red-500 transition-colors">
              {isAdmin ? <DollarSign size={24} /> : <Clock size={24} />}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500/30 group-hover:bg-red-500 transition-colors"></div>
        </div>
      </div>

      {/* Charts Area (Admin Only for detailed View) */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg col-span-1 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Activity size={18} className="text-marvil-orange" />
              Fluxo de Gastos (Mensal)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6600" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FF6600" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="date" stroke="#666" tick={{fontSize: 12}} />
                  <YAxis stroke="#666" tick={{fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', color: '#fff' }}
                    itemStyle={{ color: '#FF6600' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#FF6600" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart - Categories */}
          <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
             <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
               <PieIcon size={18} className="text-marvil-orange" />
               Gastos por Categoria
             </h3>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={categoryData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     fill="#8884d8"
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {categoryData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', color: '#fff' }} />
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </div>

           {/* Bar Chart - Employee */}
           <div className="bg-marvil-card border border-marvil-border p-6 rounded-lg">
             <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
               <Users size={18} className="text-marvil-orange" />
               Gastos por Funcionário
             </h3>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={employeeData}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                   <XAxis dataKey="name" stroke="#666" tick={{fontSize: 12}} />
                   <YAxis stroke="#666" tick={{fontSize: 12}} />
                   <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', color: '#fff' }} />
                   <Bar dataKey="valor" fill="#FF6600" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
