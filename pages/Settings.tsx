
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Database, Save, Download, Shield, CheckCircle, Server, Bell, Moon, Clock, FileText, ToggleLeft, ToggleRight, AlertTriangle, Info, Lock, Key, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const SettingsPage = () => {
  const { user } = useAuth();
  
  // Local Settings States (Global)
  const [companyName, setCompanyName] = useState(localStorage.getItem('companyName') || 'Elétrica Marvil');
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notificationsEnabled') !== 'false');
  const [compactMode, setCompactMode] = useState(localStorage.getItem('compactMode') === 'true');
  const [checklistReminder, setChecklistReminder] = useState(localStorage.getItem('checklistReminder') || '08:00');
  const [dailyChecklistLimit, setDailyChecklistLimit] = useState(localStorage.getItem('dailyChecklistLimit') || '2');
  
  // Password Change States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'error'>('checking');

  const isAdmin = user?.role === 'admin';

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      localStorage.setItem('companyName', companyName);
      localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
      localStorage.setItem('compactMode', String(compactMode));
      localStorage.setItem('checklistReminder', checklistReminder);
      localStorage.setItem('dailyChecklistLimit', dailyChecklistLimit);
      
      alert('Preferências do sistema salvas com sucesso!');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Validações Básicas
      if (!newPassword || !confirmPassword) {
          alert("Preencha os campos de senha.");
          return;
      }
      if (newPassword !== confirmPassword) {
          alert("As senhas não coincidem.");
          return;
      }
      if (newPassword.length < 6) {
          alert("A senha deve ter no mínimo 6 caracteres.");
          return;
      }

      setPasswordLoading(true);
      
      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          
          if (error) throw error;
          
          // Ordem importante: Limpa o form e remove o loading ANTES do alert
          setNewPassword('');
          setConfirmPassword('');
          setPasswordLoading(false);

          // Timeout pequeno para garantir que o React renderize o botão "normal" antes do alert bloquear a tela
          setTimeout(() => {
              alert("Senha atualizada com sucesso!");
          }, 100);
          
      } catch (err: any) {
          console.error(err);
          setPasswordLoading(false);
          setTimeout(() => {
              alert(`Erro ao atualizar senha: ${err.message}`);
          }, 100);
      }
  };

  const checkDbConnection = async () => {
      setDbStatus('checking');
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      if (error) {
          setDbStatus('error');
      } else {
          setDbStatus('online');
      }
  };

  // Run initial DB check only for admins
  useEffect(() => {
      if (isAdmin) checkDbConnection();
  }, [isAdmin]);

  const handleExportData = async (table: string) => {
      setLoading(true);
      try {
          const { data, error } = await supabase.from(table).select('*');
          if (error) throw error;
          
          if (!data || data.length === 0) {
              alert('Sem dados para exportar.');
              return;
          }

          const headers = Object.keys(data[0]).join(',');
          const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
          const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `${table}_backup_${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (err: any) {
          alert('Erro ao exportar: ' + err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-10">
        <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-gray-800 rounded-xl">
                <SettingsIcon size={32} className="text-primary" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white">Configurações</h1>
                <p className="text-gray-400 text-sm">Gerencie sua conta {isAdmin && 'e o sistema'}.</p>
            </div>
        </div>

        {/* --- SECTION 1: USER SETTINGS (Available to All) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                 <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg h-full">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl font-bold text-white mb-3">
                            {user?.name?.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold text-white">{user?.name}</h2>
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mt-1 uppercase">
                            {user?.role}
                        </span>
                        <p className="text-gray-500 text-xs mt-2">{user?.email}</p>
                    </div>
                 </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                    <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Lock size={20} className="text-primary" />
                        Segurança e Login
                    </h2>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                    <Key size={16} /> Nova Senha
                                </label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                    <Key size={16} /> Confirmar Senha
                                </label>
                                <input 
                                    type="password" 
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Repita a senha"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button 
                                type="submit" 
                                disabled={passwordLoading || !newPassword}
                                className="bg-gray-800 hover:bg-primary text-white px-6 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 hover:border-primary flex items-center gap-2"
                            >
                                {passwordLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {passwordLoading ? 'Atualizando...' : 'Alterar Senha'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        {/* --- SECTION 2: ADMIN SETTINGS (Restricted) --- */}
        {isAdmin && (
            <>
                <div className="border-t border-gray-800 pt-6 mt-6">
                    <h2 className="text-xl font-bold text-white mb-4">Administração do Sistema</h2>
                </div>

                <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* General & UX */}
                    <div className="space-y-6 lg:col-span-2">
                        <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Shield size={20} className="text-blue-400" />
                                Geral e Aparência
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Nome da Empresa</label>
                                    <input 
                                        type="text" 
                                        value={companyName} 
                                        onChange={e => setCompanyName(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none transition-colors"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Recarregue a página para ver a alteração no menu.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <Bell className="text-yellow-400" size={20} />
                                            <div>
                                                <p className="text-white font-medium">Notificações</p>
                                                <p className="text-xs text-gray-500">Alertas do sistema</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setNotificationsEnabled(!notificationsEnabled)} className="text-primary focus:outline-none">
                                            {notificationsEnabled ? <ToggleRight size={32} className="text-primary" /> : <ToggleLeft size={32} className="text-gray-600" />}
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <Moon className="text-purple-400" size={20} />
                                            <div>
                                                <p className="text-white font-medium">Modo Compacto</p>
                                                <p className="text-xs text-gray-500">Listas densas</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setCompactMode(!compactMode)} className="text-primary focus:outline-none">
                                            {compactMode ? <ToggleRight size={32} className="text-primary" /> : <ToggleLeft size={32} className="text-gray-600" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <FileText size={20} className="text-orange-400" />
                                Regras Operacionais
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                        <Clock size={16} /> Horário Lembrete Checklist
                                    </label>
                                    <input 
                                        type="time" 
                                        value={checklistReminder} 
                                        onChange={e => setChecklistReminder(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                        <AlertTriangle size={16} /> Limite Diário de Checklists
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="10"
                                        value={dailyChecklistLimit} 
                                        onChange={e => setDailyChecklistLimit(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Qtd. máxima por eletricista/dia.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button type="submit" className="w-full md:w-auto bg-primary hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95">
                                <Save size={18} /> Salvar Configurações Globais
                            </button>
                        </div>
                    </div>

                    {/* System Health & Backup */}
                    <div className="space-y-6">
                        {/* System Health */}
                        <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Server size={20} className="text-purple-400" />
                                Diagnóstico
                            </h2>
                            <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-800">
                                <div className="flex items-center gap-3">
                                    <Database size={24} className="text-gray-400" />
                                    <div>
                                        <p className="font-medium text-white">Banco de Dados</p>
                                        <p className="text-xs text-gray-500">Supabase (PostgreSQL)</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {dbStatus === 'online' && <span className="flex items-center gap-1 text-green-400 text-sm font-bold"><CheckCircle size={16}/> Online</span>}
                                    {dbStatus === 'error' && <span className="flex items-center gap-1 text-red-400 text-sm font-bold"><AlertTriangle size={16}/> Erro</span>}
                                    {dbStatus === 'checking' && <span className="text-gray-500 text-sm">...</span>}
                                    
                                    <button type="button" onClick={checkDbConnection} className="text-primary hover:text-white text-sm underline">
                                        Testar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Data Backup */}
                        <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Download size={20} className="text-blue-400" />
                                Backup de Dados
                            </h2>
                            <p className="text-sm text-gray-400 mb-4">
                                Download dos dados em formato CSV.
                            </p>
                            <div className="space-y-3">
                                <button type="button" onClick={() => handleExportData('profiles')} disabled={loading} className="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left text-white flex justify-between items-center text-sm transition-colors">
                                    <span>Usuários</span> <FileText size={16} className="text-gray-500" />
                                </button>
                                <button type="button" onClick={() => handleExportData('projects')} disabled={loading} className="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left text-white flex justify-between items-center text-sm transition-colors">
                                    <span>Obras</span> <FileText size={16} className="text-gray-500" />
                                </button>
                                <button type="button" onClick={() => handleExportData('finance_entries')} disabled={loading} className="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left text-white flex justify-between items-center text-sm transition-colors">
                                    <span>Financeiro</span> <FileText size={16} className="text-gray-500" />
                                </button>
                                <button type="button" onClick={() => handleExportData('checklists')} disabled={loading} className="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left text-white flex justify-between items-center text-sm transition-colors">
                                    <span>Checklists</span> <FileText size={16} className="text-gray-500" />
                                </button>
                                <div className="pt-2 border-t border-gray-800 mt-2">
                                    <button type="button" onClick={() => handleExportData('chat_messages')} disabled={loading} className="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left text-white flex justify-between items-center text-sm transition-colors">
                                        <span>Mensagens (Chat)</span> <FileText size={16} className="text-gray-500" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* System Info Section */}
                        <div className="bg-secondary p-6 rounded-xl border border-gray-800 shadow-lg">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Info size={20} className="text-gray-400" />
                                Sobre o Sistema
                            </h2>
                            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-400 space-y-2">
                                <p>Versão do Sistema: <strong className="text-white">v1.3.0</strong></p>
                                <p>ID da Instância: <span className="font-mono text-gray-500">{user?.id.substring(0,8)}...</span></p>
                                <p className="pt-2 border-t border-gray-800 mt-2">
                                    Desenvolvido por <a href="https://www.tisemfronteira.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-orange-400 font-bold">TI SEM FRONTEIRA</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            </>
        )}
    </div>
  );
};

export default SettingsPage;
