'use client';

import ChatRoom from '../../../components/ChatRoom';

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Community Chat</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <ChatRoom roomType="global" roomId="lobby" />
        <ChatRoom roomType="match" roomId="current-match" />
        <ChatRoom roomType="clan" roomId="my-clan" />
      </div>
    </div>
  );
}
