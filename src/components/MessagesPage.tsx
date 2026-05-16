'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';
import {
  MessageSquare, Send, Loader2, Trash2, Edit3, X, Check,
  RefreshCw, CheckSquare, Square, Clock, Plus, Hash
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  telegram_message_id: number | null;
  telegram_chat_id: string | null;
  author_name: string;
  channel_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast('success', 'Message sent to Telegram!');
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to send');
    } finally { setSending(false); }
  };

  const editMessage = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent }),
      });
      if (!res.ok) throw new Error('Edit failed');
      toast('success', 'Message updated');
      setEditingId(null);
      fetchMessages();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Edit failed');
    }
  };

  const deleteMessages = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} message(s)? This also removes from Telegram.`)) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Delete failed');
      toast('success', `${ids.length} message(s) deleted`);
      setSelected(new Set());
      fetchMessages();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredMessages.length) setSelected(new Set());
    else setSelected(new Set(filteredMessages.map(m => m.id)));
  };

  const filteredMessages = messages.filter(m =>
    m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.channel_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Group by date
  const grouped: Record<string, Message[]> = {};
  filteredMessages.forEach(m => {
    const day = new Date(m.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(m);
  });

  return (
    <div className="min-h-screen bg-[var(--background)] pt-16 pb-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#6366f1]/20">
                <MessageSquare className="w-6 h-6 text-[#6366f1]" />
              </div>
              Messages
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">Send messages to your Telegram channel</p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button onClick={() => deleteMessages(Array.from(selected))}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20">
                <Trash2 className="w-4 h-4" /> Delete {selected.size}
              </button>
            )}
            <button onClick={fetchMessages} className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted)] hover:text-[var(--foreground)]">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Compose */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type a message to send to Telegram..."
            rows={3}
            className="w-full bg-transparent text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted)]">Supports HTML formatting. Press Enter to send.</p>
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="w-full px-4 py-2.5 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
      </header>

      {/* Messages Timeline */}
      <main className="max-w-4xl mx-auto px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-20">
            <div className="p-4 rounded-2xl bg-[var(--secondary)] inline-block mb-4">
              <MessageSquare className="w-12 h-12 text-[var(--muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              {messages.length === 0 ? 'No messages yet' : 'No matches'}
            </h3>
            <p className="text-[var(--muted)] text-sm">
              {messages.length === 0 ? 'Send your first message to Telegram above' : 'Try a different search'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Select all */}
            <div className="flex items-center gap-3 py-2 px-3 bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <button onClick={toggleSelectAll} className="p-1">
                {selected.size === filteredMessages.length && filteredMessages.length > 0
                  ? <CheckSquare className="w-5 h-5 text-[#6366f1]" />
                  : <Square className="w-5 h-5 text-gray-500" />}
              </button>
              <span className="text-sm text-[var(--muted)]">
                {selected.size > 0 ? `${selected.size} selected` : ''}
              </span>
              <span className="text-sm text-[var(--muted)] ml-auto">{filteredMessages.length} messages</span>
            </div>

            {Object.entries(grouped).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-[var(--muted)]" />
                  <span className="text-sm font-medium text-[var(--muted)]">{date}</span>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
                  {msgs.map(msg => (
                    <div key={msg.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--secondary)]/50 transition-colors group">
                      <button onClick={() => toggleSelect(msg.id)} className="mt-1 flex-shrink-0">
                        {selected.has(msg.id)
                          ? <CheckSquare className="w-4 h-4 text-[#6366f1]" />
                          : <Square className="w-4 h-4 text-gray-500" />}
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(msg.author_name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === msg.id ? (
                          <div className="space-y-2">
                            <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                              rows={2} className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:border-[#6366f1] resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => editMessage(msg.id)} className="flex items-center gap-1 px-3 py-1.5 bg-[#6366f1] text-white rounded-lg text-xs"><Check className="w-3 h-3" /> Save</button>
                              <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--secondary)] text-[var(--muted)] rounded-lg text-xs"><X className="w-3 h-3" /> Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--muted)]">
                              <span>{msg.author_name}</span>
                              {msg.channel_name && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{msg.channel_name}</span>}
                              <span>{formatDate(msg.created_at)}</span>
                              {msg.updated_at !== msg.created_at && <span className="italic">(edited)</span>}
                            </div>
                          </>
                        )}
                      </div>
                      {editingId !== msg.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[#6366f1] hover:bg-[#6366f1]/10">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMessages([msg.id])}
                            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
