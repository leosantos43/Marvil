
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Log } from '../types';
import { Input } from '../components/ui/Input';
import { Search, Activity } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile } = useAuthStore();

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchLogs();
    }
  }, [profile]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profile:users_profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching logs", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (profile?.role !== 'admin') return <div className="p-10 text-center text-gray-500">Acesso Negado.</div>;

  return (
    <div className="space-y-6">
       <div>
          <h1 className="text-2xl font-display font-bold text-white">Logs de Auditoria</h1>
          <p className="text-gray-400">Rastreamento de atividades do sistema</p>
       </div>

       <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
        <Input 
          className="pl-10" 
          placeholder="Buscar por ação, usuário ou detalhes..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-marvil-card border border-marvil-border rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-marvil-dark text-gray-400 uppercase font-mono">
             <tr>
               <th className="p-4">Data/Hora</th>
               <th className="p-4">Usuário</th>
               <th className="p-4">Ação</th>
               <th className="p-4">Detalhes</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-marvil-border">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center">Carregando logs...</td></tr>
            ) : filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-gray-400 font-mono text-xs">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="p-4 text-white font-semibold">
                   {log.profile?.full_name || 'Sistema'}
                </td>
                <td className="p-4">
                   <span className="px-2 py-1 bg-marvil-orange/10 text-marvil-orange border border-marvil-orange/20 rounded text-xs font-bold uppercase">
                     {log.action}
                   </span>
                </td>
                <td className="p-4 text-gray-300">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
