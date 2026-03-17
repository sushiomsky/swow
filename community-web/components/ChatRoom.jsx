'use client';

import { useEffect, useState } from 'react';
import { communitySocket, connectCommunitySocket } from '../lib/socket';
import { apiSend } from '../lib/api';

export default function ChatRoom({ roomType, roomId }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    const onConnect = () => {
      setAuthRequired(false);
      communitySocket.emit('join_room', { roomType, roomId });
    };
    const onConnectError = () => setAuthRequired(true);
    const connected = connectCommunitySocket();
    setAuthRequired(!connected);
    const onMessage = (msg) => setMessages((curr) => [...curr, msg]);
    communitySocket.on('connect', onConnect);
    communitySocket.on('connect_error', onConnectError);
    communitySocket.on('chat_message', onMessage);
    if (connected) {
      communitySocket.emit('join_room', { roomType, roomId });
    }
    return () => {
      communitySocket.off('connect', onConnect);
      communitySocket.off('connect_error', onConnectError);
      communitySocket.off('chat_message', onMessage);
    };
  }, [roomType, roomId]);

  const send = () => {
    if (!content.trim()) return;
    if (!communitySocket.connected) {
      const connected = connectCommunitySocket();
      setAuthRequired(!connected);
      if (!connected) return;
      communitySocket.emit('join_room', { roomType, roomId });
    }
    communitySocket.emit('chat_message', { roomType, roomId, content });
    setContent('');
  };

  const reportMessage = async (messageId) => {
    try {
      const token = localStorage.getItem('communityToken');
      await apiSend(`/chat/report/${messageId}`, 'POST', { reason: 'abuse' }, token);
    } catch (_) {}
  };

  return (
    <section className="card">
      <h3 className="mb-2 text-lg font-semibold">Chat • {roomType}:{roomId}</h3>
      {authRequired && <p className="mb-2 text-xs text-amber-300">Sign in to join live chat.</p>}
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
