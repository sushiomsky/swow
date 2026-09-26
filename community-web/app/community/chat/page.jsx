'use client';

import ChatRoom from '../../../components/ChatRoom';

const CHAT_ROOMS = [
  { roomType: 'global', roomId: 'lobby', label: 'Lobby' },
  { roomType: 'match', roomId: 'current-match', label: 'Aktuelles Spiel' },
  { roomType: 'clan', roomId: 'my-clan', label: 'Mein Clan' }
];

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chat</h1>
      <p className="text-sm text-zinc-300">
        Wechsle zwischen Räumen, ohne den Zusammenhang zu verlieren. Ungelesene Markierungen und Verlauf machen jeden Raum leicht verfolgbar.
      </p>
      <ChatRoom roomType="global" roomId="lobby" roomOptions={CHAT_ROOMS} />
    </div>
  );
}
