'use client';

import { useEffect, useState } from 'react';
import { communitySocket } from '../lib/socket';

export default function ChatRoom({ roomType, roomId, senderId = 'demo-user' }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!communitySocket.connected) communitySocket.connect();
    communitySocket.emit('join_room', { roomType, roomId });
    const onMessage = (msg) => setMessages((curr) => [...curr, msg]);
    communitySocket.on('chat_message', onMessage);
    return () => communitySocket.off('chat_message', onMessage);
  }, [roomType, roomId]);

  const send = () => {
    if (!content.trim()) return;
    communitySocket.emit('chat_message', { senderId, roomType, roomId, content });
    setContent('');
  };

  return (
    <section className="card">
      <h3 className="mb-2 text-lg font-semibold">Chat • {roomType}:{roomId}</h3>
      <div className="mb-3 h-56 overflow-auto rounded border border-zinc-800 p-2 text-sm">
        {messages.map((m, i) => (
          <p key={m.message_id || i} className="mb-1">
            <span className="text-zinc-500">{m.sender_id}: </span>
            {m.content}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Write message..."
        />
        <button onClick={send} className="rounded bg-indigo-600 px-4 py-2 text-sm">Send</button>
      </div>
    </section>
  );
}
