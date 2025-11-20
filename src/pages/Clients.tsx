import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, User, Plus, Phone, Mail, Trash2, Edit2 } from 'lucide-react';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('responsaveis').select('*').order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && formData.id) {
        const { error } = await supabase
          .from('responsaveis')
          .update({
             name: formData.name,
             email: formData.email,
             phone: formData.phone,
             notes: formData.notes
          })
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('responsaveis').insert([{
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            notes: formData.notes
        }]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchClients();
      resetForm();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso pode afetar obras vinculadas.')) return;
    await supabase.from('responsaveis').delete().eq('id', id);
    fetchClients();
  };

  const handleEdit = (client: Client) => {
    setFormData({
      id: client.id,
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      notes: client.notes || ''
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ id: '', name: '', email: '', phone: '', notes: '' });
    setIsEditing(false);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Clientes & Responsáveis</h1>
          <p className="text-gray-400">Gerencie os clientes das obras</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="shadow-glow">
          <Plus size={18} className="mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
        <Input 
          className="pl-10" 
          placeholder="Buscar cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
         {loading ? (
            <div className="col-span-full text-center py-10 text-gray-500">Carregando...</div>
         ) : filteredClients.map(client => (
            <div key={client.id} className="bg-marvil-card border border-marvil-border rounded-lg p-6 hover:border-marvil-orange/50 transition-colors group">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded bg-marvil-dark flex items-center justify-center text-marvil-orange border border-marvil-border">
                    <User size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(client)} className="text-gray-500 hover:text-white transition-colors"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(client.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </div>
               </div>
               
               <h3 className="text-lg font-bold text-white mb-1">{client.name}</h3>
               <div className="space-y-2 mt-4">
                 {client.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                       <Mail size={14} /> <span>{client.email}</span>
                    </div>
                 )}
                 {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                       <Phone size={14} /> <span>{client.phone}</span>
                    </div>
                 )}
               </div>
               {client.notes && (
                 <div className="mt-4 p-3 bg-marvil-dark rounded text-xs text-gray-500 italic border border-marvil-border">
                   "{client.notes}"
                 </div>
               )}
            </div>
         ))}
         {!loading && filteredClients.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500 bg-marvil-card border border-marvil-border rounded-lg">
               Nenhum cliente encontrado.
            </div>
         )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-marvil-card border border-marvil-border rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-6">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Nome / Razão Social" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <Input type="email" label="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <Input label="Telefone / WhatsApp" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
              
              <div className="w-full">
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Observações</label>
                <textarea 
                  className="w-full bg-marvil-dark border border-marvil-border rounded px-4 py-2.5 text-white focus:border-marvil-orange outline-none h-24"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1">Salvar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};