'use client';

import ChatRoom from '../../../components/ChatRoom';
import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Chat',
    intro: 'Wechsle zwischen Räumen, ohne den Zusammenhang zu verlieren. Ungelesene Markierungen und Verlauf machen jeden Raum leicht verfolgbar.',
    rooms: [
      { roomType: 'global', roomId: 'lobby', label: 'Lobby' },
      { roomType: 'match', roomId: 'current-match', label: 'Aktuelles Spiel' },
      { roomType: 'clan', roomId: 'my-clan', label: 'Mein Clan' }
    ]
  },
  en: {
    title: 'Chat',
    intro: 'Switch between rooms without losing context. Unread markers and history keep every room easy to follow.',
    rooms: [
      { roomType: 'global', roomId: 'lobby', label: 'Lobby' },
      { roomType: 'match', roomId: 'current-match', label: 'Current match' },
      { roomType: 'clan', roomId: 'my-clan', label: 'My clan' }
    ]
  }
};

export default function ChatPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-sm text-zinc-300">
        {t.intro}
      </p>
      <ChatRoom roomType="global" roomId="lobby" roomOptions={t.rooms} />
    </div>
  );
}
