
import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Profile, AppChatMessage } from '../types';
import { Send, Search, Hash, Circle } from 'lucide-react';

export const ChatApp: React.FC = () => {
  const { profile } = useAuthStore();
  const [activeChannel, setActiveChannel] = useState<string>('general'); // 'general' or user_id
  const [users, setUsers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<AppChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<{[key: string]: number}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchUnreadCounts();

    const subscription = subscribeToMessages();
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchMessages();
    if (activeChannel !== 'general') {
      markAsRead(activeChannel);
    }
  }, [activeChannel]);

  const fetchUsers = async () => {
    // Fetch all active users except self
    const { data } = await supabase
      .from('users_profiles')
      .select('*')
      .neq('id', profile?.id)
      .eq('active', true)
      .order('full_name');
    setUsers(data || []);
  };

  const fetchUnreadCounts = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('app_chat_messages')
      .select('sender_id')
      .eq('receiver_id', profile.id)
      .eq('read', false);
    
    if (data) {
      const counts: {[key: string]: number} = {};
      data.forEach((msg: any) => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  const markAsRead = async (senderId: string) => {
    if (!profile) return;
    
    // Optimistic Update
    setUnreadCounts(prev => ({ ...prev, [senderId]: 0 }));

    await supabase
      .from('app_chat_messages')
      .update({ read: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', profile.id)
      .eq('read', false);
  };

  const fetchMessages = async () => {
    let query = supabase
      .from('app_chat_messages')
      .select('*, sender:users_profiles!sender_id(full_name)')
      .order('created_at', { ascending: true });

    if (activeChannel === 'general') {
      // Fetch general messages
      query = query.is('receiver_id', null);
    } else {
      // Fetch private messages between me and activeChannel (user)
      query = query.or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${activeChannel}),and(sender_id.eq.${activeChannel},receiver_id.eq.${profile?.id})`);
    }

    const { data } = await query;
    setMessages(data || []);
    scrollToBottom();
  };

  const subscribeToMessages = () => {
    return supabase
      .channel('global_chat')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'app_chat_messages' 
      }, (payload) => {
        const newMsg = payload.new as AppChatMessage;
        
        // Check if message belongs to current view
        const isGeneral = newMsg.receiver_id === null && activeChannel === 'general';
        const isPrivateCurrent = activeChannel !== 'general' && (
          (newMsg.sender_id === profile?.id && newMsg.receiver_id === activeChannel) || 
          (newMsg.sender_id === activeChannel && newMsg.receiver_id === profile?.id)
        );

        if (isGeneral || isPrivateCurrent) {
          fetchMessages();
          if (isPrivateCurrent && newMsg.receiver_id === profile?.id) {
            markAsRead(newMsg.sender_id);
          }
        } else if (newMsg.receiver_id === profile?.id) {
          // Message from someone else (private), update unread count
          setUnreadCounts(prev => ({
            ...prev,
            [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1
          }));
        }
      })
      .subscribe();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    const receiverId = activeChannel === 'general' ? null : activeChannel;

    const { error } = await supabase.from('app_chat_messages').insert({
      sender_id: profile.id,
      receiver_id: receiverId,
      message: newMessage,
      read: false
    });

    if (!error) {
      setNewMessage('');
      fetchMessages(); 
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActiveUser = () => users.find(u => u.id === activeChannel);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-marvil-dark border border-marvil-border rounded-lg overflow-hidden shadow-2xl">
      
      {/* Sidebar */}
      <div className="w-80 border-r border-marvil-border bg-marvil-card flex flex-col">
        <div className="p-4 border-b border-marvil-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <input 
              className="w-full bg-marvil-dark border border-marvil-border rounded px-9 py-2 text-sm text-white focus:border-marvil-orange outline-none"
              placeholder="Buscar contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* General Channel */}
          <div 
            onClick={() => setActiveChannel('general')}
            className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors ${activeChannel === 'general' ? 'bg-marvil-orange/10 border-l-4 border-marvil-orange' : 'border-l-4 border-transparent'}`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white">
              <Hash size={20} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-white">Geral - Todos</h4>
              </div>
              <p className="text-xs text-gray-500 truncate">Canal de avisos gerais</p>
            </div>
          </div>

          <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">Equipe ({filteredUsers.length})</div>

          {/* Users List */}
          {filteredUsers.map(user => (
            <div 
              key={user.id}
              onClick={() => setActiveChannel(user.id)}
              className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors ${activeChannel === user.id ? 'bg-marvil-orange/10 border-l-4 border-marvil-orange' : 'border-l-4 border-transparent'}`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-marvil-orange font-bold border border-marvil-border">
                  {user.full_name.charAt(0)}
                </div>
                {unreadCounts[user.id] > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-marvil-card">
                    {unreadCounts[user.id] > 9 ? '9+' : unreadCounts[user.id]}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-sm">{user.full_name}</h4>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0a0a0a] relative">
        {/* Header */}
        <div className="h-16 border-b border-marvil-border bg-marvil-card flex items-center px-6 gap-4 shadow-lg z-10">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white">
            {activeChannel === 'general' ? <Hash size={20} /> : (
              <span className="font-bold text-marvil-orange">{getActiveUser()?.full_name.charAt(0)}</span>
            )}
          </div>
          <div>
             <h3 className="font-bold text-white">
               {activeChannel === 'general' ? 'Chat Geral - Toda a Empresa' : getActiveUser()?.full_name}
             </h3>
             {activeChannel !== 'general' && <p className="text-xs text-green-500 flex items-center gap-1"><Circle size={8} fill="currentColor" /> Online</p>}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-[#050505] to-[#0a0a0a]">
          {messages.map((msg) => {
            const isMe = msg.sender_id === profile?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[70%] relative`}>
                    {!isMe && activeChannel === 'general' && (
                       <p className="text-[10px] text-marvil-orange font-bold mb-1 ml-1">
                         {(msg as any).sender?.full_name || 'Usuário'}
                       </p>
                    )}
                    <div className={`rounded-2xl px-4 py-2 shadow-sm ${
                      isMe 
                        ? 'bg-marvil-orange text-white rounded-tr-none' 
                        : 'bg-marvil-card text-gray-200 border border-marvil-border rounded-tl-none'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/70' : 'text-gray-500'}`}>
                        <span className="text-[10px]">
                           {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {isMe && activeChannel !== 'general' && (
                          <span className="text-[10px]">{msg.read ? '✓✓' : '✓'}</span>
                        )}
                      </div>
                    </div>
                 </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-marvil-card border-t border-marvil-border">
          <form onSubmit={handleSend} className="flex items-center gap-2">
             <input
                className="flex-1 bg-marvil-dark border border-marvil-border rounded-full px-6 py-3 text-white focus:border-marvil-orange outline-none transition-all"
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
             />
             <button 
               type="submit" 
               className="p-3 bg-marvil-orange rounded-full text-white shadow-glow hover:bg-marvil-orangeLight transition-transform transform hover:scale-105 active:scale-95"
               disabled={!newMessage.trim()}
             >
               <Send size={20} />
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};
