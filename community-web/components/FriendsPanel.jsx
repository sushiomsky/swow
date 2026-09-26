'use client';

import { useEffect, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

const STRINGS = {
  de: {
    friends: 'Freunde',
    friendPlaceholder: 'Benutzername des Freunds',
    add: 'Hinzufügen',
    noFriends: 'Noch keine Freunde.',
    signInToManage: 'Melde dich an, um Freunde zu verwalten.',
    signInToSend: 'Melde dich an, um Freundschaftsanfragen zu senden.',
    requestSent: 'Anfrage gesendet.',
    loadFailed: 'Freunde konnten nicht geladen werden.',
    requestFailed: 'Anfrage fehlgeschlagen.'
  },
  en: {
    friends: 'Friends',
    friendPlaceholder: "Friend's username",
    add: 'Add',
    noFriends: 'No friends yet.',
    signInToManage: 'Sign in to manage friends.',
    signInToSend: 'Sign in to send friend requests.',
    requestSent: 'Request sent.',
    loadFailed: 'Could not load friends.',
    requestFailed: 'Request failed.'
  }
};

export default function FriendsPanel() {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const [friends, setFriends] = useState([]);
  const [friendId, setFriendId] = useState('');
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();

  const load = async () => {
    try {
      if (!isAuthenticated) {
        setFriends([]);
        setStatus(t.signInToManage);
        return;
      }
      const rows = await api.listFriends();
      setFriends(rows || []);
      setStatus('');
    } catch (error) {
      setStatus(toUserErrorMessage(error, t.loadFailed));
    }
  };

  useEffect(() => { load(); }, [isAuthenticated, api]);

  const sendRequest = async () => {
    try {
      if (!isAuthenticated) {
        setStatus(t.signInToSend);
        return;
      }
      await api.sendFriendRequest(friendId);
      setStatus(t.requestSent);
      setFriendId('');
      await load();
    } catch (error) {
      setStatus(toUserErrorMessage(error, t.requestFailed));
    }
  };

  return (
    <section className="card space-y-3">
      <h3 className="text-lg font-semibold">{t.friends}</h3>
      <div className="flex gap-2">
        <input value={friendId} onChange={(e) => setFriendId(e.target.value)} placeholder={t.friendPlaceholder} aria-label={t.friendPlaceholder} className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={sendRequest}>{t.add}</button>
      </div>
      <ul className="space-y-2 text-sm">
        {friends.map((f) => (
          <li key={f.friend_id} className="rounded border border-zinc-700 p-2">
            {(f.display_name || f.username)} <span className="text-zinc-500">({f.status})</span>
          </li>
        ))}
        {friends.length === 0 && <li className="text-zinc-400">{t.noFriends}</li>}
      </ul>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </section>
  );
}
