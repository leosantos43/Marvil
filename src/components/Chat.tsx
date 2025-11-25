
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types';
import { Send, Paperclip } from 'lucide-react';

interface ChatProps {
  projectId: string;
  userId: string;
}

export const Chat: React.FC<ChatProps> = ({ projectId, userId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    // Realtime Subscription
    const channel = supabase
      .channel(`chat:${projectId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `project_id=eq.${projectId}` 
      }, (payload) => {
        // Ideally fetch the user profile for the new message or optimize payload
        fetchNewMessageWithProfile(payload.new.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchNewMessageWithProfile = async (msgId: string) => {
    const { data } = await supabase.from('messages').select('*, profile:users_profiles(*)').eq('id', msgId).single();
    if (data) {
      setMessages(prev => {
        // Avoid duplicate messages if fast switching
        if (prev.find(m => m.id === msgId)) return prev;
        const newState = [...prev, data];
        // Sort again to be safe
        return newState.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      scrollToBottom();
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profile:users_profiles(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const { error } = await supabase.from('messages').insert({
      project_id: projectId,
      user_id: userId,
      message: newMessage
    });

    if (!error) {
      setNewMessage('');
    } else {
      console.error("Error sending message:", error);
      alert("Erro ao enviar mensagem. Verifique sua conexão.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-marvil-dark border border-marvil-border rounded-lg overflow-hidden shadow-2xl">
      <div className="bg-marvil-card p-4 border-b border-marvil-border">
        <h3 className="text-white font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Chat da Obra
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
        {messages.map((msg) => {
          const isMe = msg.user_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg p-3 ${isMe ? 'bg-marvil-orange text-white' : 'bg-marvil-card text-gray-200 border border-marvil-border'}`}>
                {!isMe && <p className="text-xs text-gray-400 font-bold mb-1">{msg.profile?.full_name}</p>}
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <span className="text-[10px] opacity-50 block text-right mt-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-marvil-card border-t border-marvil-border flex gap-3">
        <input
          type="text"
          className="flex-1 bg-marvil-dark border border-marvil-border rounded px-4 py-2 text-white focus:border-marvil-orange outline-none"
          placeholder="Digite sua mensagem..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" className="p-2 bg-marvil-orange text-white rounded hover:bg-marvil-orangeLight shadow-glow transition-all">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};
