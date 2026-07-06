import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import api from '../utils/api';

interface Message {
  id: string;
  role: string;
  content: string;
}

export function Copilot() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'company') {
      initializeConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeConversation = async () => {
    try {
      // Create a new conversation on mount
      const res = await api.post('/ai/conversations');
      setConversationId(res.data.data.id);
      setMessages([
        { id: 'initial', role: 'assistant', content: 'Hello. I am the GMPL Enterprise AI Copilot. You can ask me questions about production totals, RM consumption, mould life, or vendor performance. How can I help you today?' }
      ]);
    } catch (err) {
      console.error('Failed to init conversation', err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    initializeConversation();
  };

  if (user?.role !== 'company') {
    return <div className="p-margin font-body-md text-danger">Access Denied. Copilot is restricted to Company Admins.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !conversationId) return;

    const userMessageContent = query;
    setMessages(prev => [...prev, { id: 'temp-' + Date.now(), role: 'user', content: userMessageContent }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.post(`/ai/conversations/${conversationId}/messages`, { content: userMessageContent });
      const aiReply = res.data.data;
      setMessages(prev => [...prev, { id: aiReply.id, role: aiReply.role, content: aiReply.content }]);
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-margin flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-background">
      <header className="mb-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary text-on-primary flex items-center justify-center border-2 border-on-background neo-shadow-sm">
            <span className="material-symbols-outlined text-[28px]">smart_toy</span>
          </div>
          <div>
            <h1 className="font-display-lg text-[32px] text-on-background leading-none tracking-tight">AI Copilot</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-1">Enterprise Analytics Agent</p>
          </div>
        </div>
        <button onClick={startNewChat} className="font-label-sm text-label-sm uppercase bg-surface border-2 border-on-background px-4 py-2 hover:bg-surface-variant transition-colors hover:neo-active shadow-[4px_4px_0px_#1A1A1A]">
          New Chat
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 bg-surface border-2 border-on-background neo-shadow flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
              <div className={`w-10 h-10 shrink-0 flex items-center justify-center border-2 border-on-background ${msg.role === 'user' ? 'bg-secondary-fixed' : 'bg-primary-container text-on-primary-container'}`}>
                <span className="material-symbols-outlined fill-icon">{msg.role === 'user' ? 'person' : 'smart_toy'}</span>
              </div>
              <div className={`p-4 border-2 border-on-background ${msg.role === 'user' ? 'bg-surface-container-highest neo-shadow-sm' : 'bg-surface neo-shadow'}`}>
                <p className="font-body-md text-body-md whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && idx > 0 && (
                  <div className="mt-4 pt-3 border-t-2 border-dashed border-on-background flex justify-between items-center opacity-60">
                    <span className="font-data-md text-[10px] uppercase">Confidence: 98%</span>
                    <button className="hover:text-primary"><span className="material-symbols-outlined text-[16px]">thumb_up</span></button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="self-start flex gap-4 max-w-[80%]">
               <div className="w-10 h-10 shrink-0 flex items-center justify-center border-2 border-on-background bg-primary-container text-on-primary-container animate-pulse">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="p-4 border-2 border-on-background bg-surface font-body-md flex items-center gap-2 text-secondary">
                Analyzing production data...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-4 bg-surface-container-low border-t-2 border-on-background">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about production, vendors, or moulds..." 
              className="flex-1 bg-surface border-2 border-on-background p-4 font-body-md focus:outline-none neo-shadow-sm focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_#1A1A1A] transition-all"
            />
            <button 
              type="submit" 
              disabled={loading || !query.trim()}
              className="bg-primary text-on-primary border-2 border-on-background px-8 hover:bg-surface-tint disabled:opacity-50 transition-colors flex items-center justify-center neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A]"
            >
              <span className="material-symbols-outlined text-[24px]">send</span>
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="font-label-sm text-[10px] uppercase text-on-surface-variant">AI can make mistakes. Verify critical figures in Analytics.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
