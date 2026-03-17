'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useRealtime, useRealtimeEvent, useRealtimeRoom } from '../providers/RealtimeProvider';

export default function ChatRoom({ roomType, roomId }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const { isAuthenticated, api } = useCommunitySession();
  const { connected, connectionError, emit } = useRealtime();

  useRealtimeRoom(roomType, roomId, isAuthenticated);
  const onMessage = useCallback((msg) => {
    if (msg?.room_type !== roomType || msg?.room_id !== roomId) return;
    setMessages((curr) => [...curr, msg]);
  }, [roomType, roomId]);
  useRealtimeEvent('chat_message', onMessage);

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthRequired(true);
      return;
    }
    setAuthRequired(!connected);
  }, [isAuthenticated, connected]);

  const send = () => {
    if (!content.trim()) return;
    if (!isAuthenticated || !connected) {
      setAuthRequired(true);
      return;
    }
    const sent = emit('chat_message', { roomType, roomId, content });
    if (!sent) {
      setAuthRequired(true);
      return;
    }
    setContent('');
  };

  const reportMessage = async (messageId) => {
    try {
      await api.reportChatMessage(messageId, 'abuse');
    } catch (_) {}
  };

  return (
    <section className="card">
      <h3 className="mb-2 text-lg font-semibold">Chat • {roomType}:{roomId}</h3>
      {authRequired && <p className="mb-2 text-xs text-amber-300">Sign in to join live chat.</p>}
      {!authRequired && connectionError && <p className="mb-2 text-xs text-amber-300">{connectionError}</p>}
      <div className="mb-3 h-56 overflow-auto rounded border border-zinc-800 p-2 text-sm">
        {messages.map((m, i) => (
          <p key={m.message_id || i} className="mb-1">
            <span className="text-zinc-500">{m.sender_id || 'system'}: </span>
            {m.content}
            {m.message_id && (
              <button onClick={() => reportMessage(m.message_id)} className="ml-2 text-xs text-rose-300 underline">report</button>
            )}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Write message..."
          disabled={authRequired}
        />
        <button onClick={send} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60" disabled={authRequired}>Send</button>
      </div>
    </section>
  );
}
