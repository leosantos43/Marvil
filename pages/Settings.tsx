
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Database, Save, Download, Shield, CheckCircle, Server, Bell, Moon, Clock, FileText, ToggleLeft, ToggleRight, AlertTriangle, Info, Lock, Key, User, Terminal, Copy } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const SettingsPage = () => {
  const { user } = useAuth();
  
  // Local Settings States (Global Logic via DB)
  const [companyName, setCompanyName] = useState(localStorage.getItem('companyName') || 'Elétrica Marvil');
  
  // Local Preferences (Browser specific)
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notificationsEnabled') !== 'false');
  const [compactMode, setCompactMode] = useState(localStorage.getItem('compactMode') === 'true');
  const [checklistReminder, setChecklistReminder] = useState(localStorage.getItem('checklistReminder') || '08:00');
  
  // Password Change States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'error'>('checking');
  
  // SQL Modal
  const [showSqlModal, setShowSqlModal] = useState(false);

  const isAdmin = user?.role === 'admin';

  const SQL_CONFIG_SCRIPT = `
-- Cria tabela de configurações globais
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler (para aplicar regras)
DROP POLICY IF EXISTS "Todos leem settings" ON public.system_settings;
CREATE POLICY "Todos leem settings" ON public.system_settings FOR SELECT USING (true);

-- Política: Apenas Admin pode alterar
DROP POLICY IF EXISTS "Admin gerencia settings" ON public.system_settings;
CREATE POLICY "Admin gerencia settings" ON public.system_settings FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Insere valores padrão
INSERT INTO public.system_settings (key, value) VALUES 
('company_name', 'Elétrica Marvil')
ON CONFLICT (key) DO NOTHING;
  `;

  // Fetch Global Settings from DB
  useEffect(() => {
    const fetchGlobalSettings = async () => {
        if (!isAdmin) return;
        try {
            const { data, error } = await supabase.from('system_settings').select('key, value');
            if (data) {
                const companySetting = data.find(s => s.key === 'company_name');
                if (companySetting) setCompanyName(companySetting.value);
            }
        } catch (err) {
            console.log('Tabela de configurações ainda não criada ou erro de conexão.');
        }
    };
    fetchGlobalSettings();
  }, [isAdmin]);

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingSettings(true);

      // 1. Salvar Preferências Locais (Browser)
      localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
      localStorage.setItem('compactMode', String(compactMode));
      localStorage.setItem('checklistReminder', checklistReminder);
      
      // Fallback local para percepção imediata
      localStorage.setItem('companyName', companyName);

      try {
          // 2. Salvar Configurações Globais (DB) - Apenas Admin
          if (isAdmin) {
              const settingsToSave = [
                  { key: 'company_name', value: companyName }
              ];

              const { error } = await supabase.from('system_settings').upsert(settingsToSave, { onConflict: 'key' });

              if (error) {
                  // Se erro for 42P01 (undefined table), avisar usuário
                  if (error.code === '42P01') {
                      throw new Error("TABELA_INEXISTENTE");
                  }
                  throw error;
              }
          }
          alert('Preferências salvas com sucesso!');
      } catch (err: any) {
          console.error(err);
          if (err.message === "TABELA_INEXISTENTE") {
             setShowSqlModal(true); // Abre o modal automaticamente
             alert("ATENÇÃO: A tabela 'system_settings' não existe no banco de dados. \n\nO SQL necessário foi exibido na tela. Por favor, execute-o no Supabase.");
          } else {
             const safeMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
             alert('Configurações salvas localmente, mas houve erro ao salvar no servidor: ' + safeMsg);
          }
      } finally {
          setSavingSettings(false);
      }
  };

  const copyConfigSql = () => {
      navigator.clipboard.writeText(SQL_CONFIG_SCRIPT);
      alert("SQL copiado para a área de transferência!");
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
          const rows = data.map(obj => Object.values(obj).map(val => {
             // Handle Objects/Arrays to avoid [object Object] in CSV
             if (typeof val === 'object' && val !== null) return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
             return `"${val}"`;
          }).join(',')).join('\n');
          
          const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `${table}_backup_${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (err: any) {
          const safeMsg = err.message || String(err);
          alert('Erro ao exportar: ' + safeMsg);
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
                            <div className="flex justify-between items-start mb-6">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Shield size={20} className="text-blue-400" />
                                    Geral e Aparência
                                </h2>
                                <button type="button" onClick={() => setShowSqlModal(true)} className="text-xs flex items-center gap-1 text-gray-500 hover:text-primary transition-colors border border-gray-700 px-2 py-1 rounded">
                                    <Terminal size={12} /> Ver SQL de Configuração
                                </button>
                            </div>

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
                                <div className="flex items-center justify-center p-4 bg-gray-900/50 rounded-lg border border-gray-800 text-gray-500 text-sm italic text-center">
                                    <p>O limite diário de checklists foi removido. O sistema agora impede duplicidade do mesmo checklist na mesma obra/dia.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button type="submit" disabled={savingSettings} className="w-full md:w-auto bg-primary hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-70">
                                <Save size={18} /> {savingSettings ? 'Salvando...' : 'Salvar Configurações Globais'}
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
                                <p>Versão do Sistema: <strong className="text-white">v1.3.1 (Global Config)</strong></p>
                                <p>ID da Instância: <span className="font-mono text-gray-500">{user?.id.substring(0,8)}...</span></p>
                                <p className="pt-2 border-t border-gray-800 mt-2">
                                    Desenvolvido por <a href="https://www.tisemfronteira.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-orange-400 font-bold">TI SEM FRONTEIRA</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </form>

                {/* SQL Modal */}
                <Modal isOpen={showSqlModal} onClose={() => setShowSqlModal(false)} title="SQL de Configuração" maxWidth="lg">
                    <div className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex gap-3">
                            <Info className="text-blue-400 shrink-0" size={20} />
                            <div className="text-sm text-blue-200">
                                <p className="font-bold mb-1">Como usar:</p>
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>Copie o código abaixo.</li>
                                    <li>Vá para o painel do Supabase {'>'} SQL Editor.</li>
                                    <li>Cole o código e clique em "Run".</li>
                                </ol>
                            </div>
                        </div>
                        
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 overflow-x-auto relative group">
                             <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                                {SQL_CONFIG_SCRIPT}
                             </pre>
                             <button 
                                onClick={copyConfigSql}
                                className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded border border-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copiar"
                             >
                                <Copy size={14} />
                             </button>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowSqlModal(false)} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">Fechar</button>
                            <button onClick={copyConfigSql} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-orange-600 flex items-center gap-2">
                                <Copy size={16} /> Copiar Código
                            </button>
                        </div>
                    </div>
                </Modal>
            </>
        )}
    </div>
  );
};

export default SettingsPage;
