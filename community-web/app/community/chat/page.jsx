'use client';

import ChatRoom from '../../../components/ChatRoom';

const CHAT_ROOMS = [
  { roomType: 'global', roomId: 'lobby', label: 'Global lobby' },
  { roomType: 'match', roomId: 'current-match', label: 'Current match' },
  { roomType: 'clan', roomId: 'my-clan', label: 'My clan' }
];

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Community Chat</h1>
      <p className="text-sm text-zinc-300">
        Switch between rooms without losing context. Unread badges and history preload keep each room easy to follow.
      </p>
      <ChatRoom roomType="global" roomId="lobby" roomOptions={CHAT_ROOMS} />
    </div>
  );
}
