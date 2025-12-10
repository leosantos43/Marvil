
import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, MoreVertical, ArrowLeft, Loader2, Search, Lock, Globe, Trash2, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChatMessage, User } from '../types';
import { useAuth } from '../context/AuthContext';

const Chat = () => {
  const { user, refreshUnreadCount } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [activeChatId, setActiveChatId] = useState<string>('global'); 
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Unread Counts per User ID
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const scrollToBottom = () => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to Mark Messages as Read
  const markMessagesAsRead = async (senderId: string) => {
      if (senderId === 'global' || !user) return;
      
      // Update local state immediately for responsiveness
      if (unreadCounts[senderId] > 0) {
        setUnreadCounts(prev => ({ ...prev, [senderId]: 0 }));
      }

      try {
          // Update messages sent BY senderId TO me where read_at is null
          await supabase
            .from('chat_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', senderId)
            .eq('recipient_id', user.id)
            .is('read_at', null);
          
          // Force Global Counter Refresh
          await refreshUnreadCount();
            
      } catch (err) {
          console.error("Error marking messages as read:", err);
      }
  };

  // 1. Fetch Contacts & Initial Unread Counts
  useEffect(() => {
    const fetchContactsAndCounts = async () => {
        if (!user) return;

        // Fetch Contacts
        const { data: profiles } = await supabase.from('profiles').select('*').neq('id', user.id);
        if (profiles) setContacts(profiles);

        // Fetch Unread Messages (Raw) to Aggregate
        const { data: unreadMsgs } = await supabase
            .from('chat_messages')
            .select('user_id')
            .eq('recipient_id', user.id)
            .is('read_at', null);
        
        if (unreadMsgs) {
            const counts: Record<string, number> = {};
            unreadMsgs.forEach(msg => {
                counts[msg.user_id] = (counts[msg.user_id] || 0) + 1;
            });
            setUnreadCounts(counts);
        }
    };
    fetchContactsAndCounts();
  }, [user]);

  // 2. Fetch Messages based on active chat
  useEffect(() => {
    const fetchMessages = async () => {
        setLoading(true);
        let query = supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);

        if (activeChatId === 'global') {
            query = query.eq('tipo_chat', 'global');
        } else {
            query = query.or(`and(user_id.eq.${user?.id},recipient_id.eq.${activeChatId}),and(user_id.eq.${activeChatId},recipient_id.eq.${user?.id})`);
            
            // Trigger mark as read when fetching private chat
            markMessagesAsRead(activeChatId);
        }
        
        const { data } = await query;
        
        if (data) {
            const enriched = data.map((msg) => {
                let senderName = 'Usuário';
                if (msg.user_id === user?.id) senderName = user.name;
                else {
                    const contact = contacts.find(c => c.id === msg.user_id);
                    if (contact) senderName = contact.name;
                }

                return {
                    ...msg,
                    user_name: senderName,
                    is_me: msg.user_id === user?.id
                };
            });
            setMessages(enriched);
        }
        setLoading(false);
    };

    if (user && (contacts.length > 0 || activeChatId === 'global')) { 
        fetchMessages();
    }
  }, [activeChatId, user, contacts]); 

  // 3. Realtime Subscription
  useEffect(() => {
    const channel = supabase
        .channel('chat_page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async (payload) => {
            
            // Handle INSERT
            if (payload.eventType === 'INSERT') {
                const newMessage = payload.new as ChatMessage;
                
                // Logic to decide if we show this message in the CURRENT active window
                let shouldShow = false;

                if (activeChatId === 'global') {
                    if (newMessage.tipo_chat === 'global') shouldShow = true;
                } else {
                    const isFromPartner = newMessage.user_id === activeChatId && newMessage.recipient_id === user?.id;
                    const isFromMeToPartner = newMessage.user_id === user?.id && newMessage.recipient_id === activeChatId;
                    if (isFromPartner || isFromMeToPartner) shouldShow = true;
                }

                // Handle Unread Counts (Local Badge)
                if (!shouldShow) {
                    // If it's a private message for me, from someone else, and I'm not looking at it
                    if (newMessage.recipient_id === user?.id && activeChatId !== newMessage.user_id) {
                         setUnreadCounts(prev => ({
                             ...prev,
                             [newMessage.user_id]: (prev[newMessage.user_id] || 0) + 1
                         }));
                    }
                } else {
                    // It is for the active window
                    
                    // If I received it in the active window, mark as read immediately
                    if (newMessage.recipient_id === user?.id && activeChatId === newMessage.user_id) {
                        markMessagesAsRead(newMessage.user_id);
                    }

                    // Append to list ONLY if it's not already there (Deduplication)
                    setMessages((prev) => {
                        if (prev.some(msg => msg.id === newMessage.id)) return prev;

                        let senderName = '...';
                        if (newMessage.user_id === user?.id) senderName = user.name;
                        else {
                            const contact = contacts.find(c => c.id === newMessage.user_id);
                            if (contact) senderName = contact.name;
                        }

                        const enrichedMessage = {
                            ...newMessage,
                            user_name: senderName,
                            is_me: newMessage.user_id === user?.id
                        };

                        return [...prev, enrichedMessage];
                    });
                }
            } 
            
            // Handle DELETE
            else if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id;
                setMessages((prev) => prev.filter(msg => msg.id !== deletedId));
            }

            // Handle UPDATE (Read Receipts)
            else if (payload.eventType === 'UPDATE') {
                const updatedMsg = payload.new as ChatMessage;
                setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, read_at: updatedMsg.read_at } : m));
            }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [user, activeChatId, contacts]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const text = input;
    setInput('');

    const payload = {
      tipo_chat: activeChatId === 'global' ? 'global' : 'private',
      user_id: user.id,
      recipient_id: activeChatId === 'global' ? null : activeChatId,
      mensagem: text,
      created_at: new Date().toISOString()
    };

    // Use .select().single() para receber o objeto criado imediatamente
    const { data, error } = await supabase.from('chat_messages').insert(payload).select().single();
    
    if (error) {
        console.error('Error sending message:', error);
        setInput(text);
        alert('Erro ao enviar mensagem.');
    } else if (data) {
        // Atualização Otimista/Imediata: Adiciona na tela sem esperar o Realtime
        const enrichedMessage: ChatMessage = {
            ...data,
            user_name: user.name,
            is_me: true
        };
        
        setMessages(prev => [...prev, enrichedMessage]);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
      // Use custom confirmation or simple check to avoid blocking
      // Using simple confirm for now as per previous fix, buttons should work if logic is sound
      const confirmDelete = window.confirm("Deseja apagar esta mensagem?");
      if (!confirmDelete) return;

      const { error } = await supabase.from('chat_messages').delete().eq('id', msgId);
      
      if (error) {
          console.error("Erro ao apagar:", error);
          if (error.code === '42501') {
             alert("Erro de permissão: Você precisa rodar o script SQL de atualização para permitir exclusão de mensagens.");
          } else {
             alert("Erro ao apagar mensagem.");
          }
      }
  };

  const handleContactClick = (id: string) => {
      setActiveChatId(id);
      setMobileView('chat');
      // Reset unread count for this user
      setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
  };

  const formatTime = (isoString: string) => {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeContact = activeChatId === 'global' 
    ? { name: 'Chat Global', role: 'Todos', status: 'online' }
    : contacts.find(c => c.id === activeChatId);

  const filteredContacts = contacts.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedContacts = {
      'Equipe': filteredContacts.filter(c => ['admin', 'eletricista'].includes(c.role)),
      'Clientes': filteredContacts.filter(c => c.role === 'cliente')
  };

  return (
    <div className="flex h-[calc(100vh-100px)] md:h-[calc(100vh-120px)] bg-secondary rounded-xl overflow-hidden border border-gray-800 animate-fade-in shadow-2xl">
      
      {/* --- LEFT SIDEBAR (Contacts) --- */}
      <div className={`
        w-full md:w-80 bg-gray-900 border-r border-gray-800 flex flex-col
        ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
      `}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
              <h2 className="text-white font-bold text-lg mb-4">Mensagens</h2>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar contato..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  />
              </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto">
              {/* Global Chat Item */}
              <div 
                onClick={() => handleContactClick('global')}
                className={`p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-gray-800/50
                    ${activeChatId === 'global' ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-gray-800 border-l-4 border-l-transparent'}
                `}
              >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary relative">
                      <Globe size={24} />
                  </div>
                  <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className="text-white font-bold">Chat Global</h3>
                      </div>
                      <p className="text-xs text-gray-400">Canal de avisos gerais</p>
                  </div>
              </div>

              {/* Grouped Lists */}
              {Object.entries(groupedContacts).map(([group, list]) => list.length > 0 && (
                  <div key={group}>
                      <div className="px-4 py-2 bg-gray-800/30 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {group}
                      </div>
                      {list.map(contact => (
                          <div 
                            key={contact.id}
                            onClick={() => handleContactClick(contact.id)}
                            className={`p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-gray-800/50
                                ${activeChatId === contact.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-gray-800 border-l-4 border-l-transparent'}
                            `}
                          >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold relative ${contact.role === 'admin' ? 'bg-purple-600' : 'bg-gray-700'}`}>
                                {contact.name.charAt(0)}
                                {unreadCounts[contact.id] > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-gray-900 flex items-center justify-center text-[10px] font-bold">
                                        {unreadCounts[contact.id] > 9 ? '9+' : unreadCounts[contact.id]}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <h3 className="text-white font-medium truncate">{contact.name}</h3>
                                    {unreadCounts[contact.id] > 0 && (
                                        <span className="text-[10px] font-bold text-red-400">
                                            {unreadCounts[contact.id]} nova(s)
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 capitalize truncate">{contact.role}</p>
                            </div>
                          </div>
                      ))}
                  </div>
              ))}
          </div>
      </div>

      {/* --- RIGHT SIDEBAR (Chat Window) --- */}
      <div className={`
        flex-1 flex flex-col bg-[#0b101a]
        ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
      `}>
          {/* Chat Header */}
          <div className="h-16 bg-secondary border-b border-gray-800 flex items-center justify-between px-4 shadow-sm z-10">
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setMobileView('list')}
                    className="md:hidden text-gray-400 hover:text-white"
                  >
                      <ArrowLeft size={24} />
                  </button>
                  
                  {activeChatId === 'global' ? (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                          <Globe size={20} />
                      </div>
                  ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
                          {activeContact?.name?.charAt(0)}
                      </div>
                  )}

                  <div>
                      <h2 className="text-white font-bold text-sm md:text-base">
                          {activeContact?.name || 'Usuário'}
                      </h2>
                      {activeChatId !== 'global' ? (
                          <div className="flex items-center gap-1 text-xs text-primary">
                             <Lock size={10} /> Mensagem Privada
                          </div>
                      ) : (
                        <div className="text-xs text-gray-400">Todos os membros</div>
                      )}
                  </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                  <MoreVertical size={20} />
              </button>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            style={{ backgroundImage: 'radial-gradient(#1f2933 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          >
            {loading && (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-primary" />
                </div>
            )}
            
            {!loading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 opacity-50">
                    <div className="p-4 bg-gray-800 rounded-full">
                        <Send size={32} />
                    </div>
                    <p>Nenhuma mensagem aqui.</p>
                    <p className="text-sm">Envie um "Olá" para começar!</p>
                </div>
            )}

            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} animate-fade-in-up group`}
              >
                {!msg.is_me && activeChatId === 'global' && (
                     <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white font-bold mr-2 mt-1 shrink-0">
                         {msg.user_name.charAt(0)}
                     </div>
                )}
                
                <div 
                  className={`
                    max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-2 relative shadow-md text-sm group-hover:shadow-lg transition-all
                    ${msg.is_me 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
                    }
                  `}
                >
                  {!msg.is_me && activeChatId === 'global' && (
                    <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">
                      {msg.user_name}
                    </p>
                  )}
                  
                  <p className="whitespace-pre-wrap break-words leading-relaxed pb-3 pr-2">{msg.mensagem}</p>
                  
                  <div className={`absolute bottom-1 right-2 flex items-center gap-1 ${msg.is_me ? 'text-white/80' : 'text-gray-400'}`}>
                     <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                         {new Date(msg.created_at).toLocaleDateString()}
                     </span>
                     <span className="text-[10px]">
                         {formatTime(msg.created_at)}
                     </span>
                     {msg.is_me && activeChatId !== 'global' && (
                         <span title={msg.read_at ? "Lida" : "Enviada"}>
                             {msg.read_at ? (
                                 <CheckCheck size={14} className="text-blue-200" />
                             ) : (
                                 <Check size={14} className="opacity-70" />
                             )}
                         </span>
                     )}
                     {msg.is_me && activeChatId === 'global' && <Check size={14} className="opacity-70" />}
                  </div>

                  {(msg.is_me || user?.role === 'admin') && (
                        <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/20 rounded ${msg.is_me ? 'text-white' : 'text-gray-400'}`}
                            title="Apagar Mensagem"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="bg-secondary p-2 md:p-3 border-t border-gray-800 z-10">
             <form onSubmit={handleSend} className="flex items-end gap-2 max-w-4xl mx-auto">
                <button type="button" className="p-3 text-gray-400 hover:text-primary transition-colors rounded-full hover:bg-gray-800 hidden md:block">
                    <Paperclip size={20} />
                </button>
                <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-700 focus-within:border-primary transition-colors">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Digite sua mensagem..." 
                        className="w-full bg-transparent text-white px-4 py-3 focus:outline-none text-sm md:text-base max-h-32"
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={!input.trim()}
                    className="p-3 bg-primary text-white rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex-shrink-0"
                >
                    <Send size={20} />
                </button>
             </form>
          </div>
      </div>
    </div>
  );
};

export default Chat;
