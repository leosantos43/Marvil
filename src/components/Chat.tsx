import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Send, Paperclip } from "lucide-react";
import { useAuthStore } from "../store/authStore";

interface Props {
  projectId: string;
  userId: string;
}

export const Chat: React.FC<Props> = ({ projectId, userId }) => {
  const { profile } = useAuthStore();

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // 🔥 Ajustes de responsividade
  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_chat", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("project_chat")
      .select("*, profile:users_profiles(*)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollToBottom();
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;

    setSending(true);

    await supabase.from("project_chat").insert({
      project_id: projectId,
      user_id: userId,
      message,
    });

    setMessage("");
    setSending(false);
    scrollToBottom();
  };

  return (
    <div className="flex flex-col h-full max-h-[88vh] md:max-h-[600px]">

      {/* AREA DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-marvil-orange/50 scrollbar-track-transparent">

        {messages.map((msg) => {
          const isMine = msg.user_id === userId;

          return (
            <div
              key={msg.id}
              className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[60%] p-3 rounded-lg text-sm shadow-md 
                  ${isMine ? "bg-marvil-orange text-white" : "bg-marvil-dark border border-marvil-border text-gray-200"}
                `}
              >
                {!isMine && (
                  <p className="text-xs text-gray-400 mb-1 font-semibold">
                    {msg.profile?.full_name}
                  </p>
                )}

                <p>{msg.message}</p>

                <p className="text-[10px] text-gray-400 text-right mt-2">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR").slice(0, 5)}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* INPUT FIXO */}
      <div className="p-3 bg-marvil-dark border-t border-marvil-border flex items-center gap-3">

        <input
          type="text"
          className="flex-1 bg-black/40 text-white p-3 rounded-lg border border-marvil-border focus:border-marvil-orange outline-none text-sm"
          placeholder="Digite uma mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button
          onClick={sendMessage}
          disabled={sending}
          className="bg-marvil-orange hover:bg-marvil-orange/80 transition-colors p-3 rounded-lg"
        >
          <Send size={18} />
        </button>

      </div>
    </div>
  );
};
