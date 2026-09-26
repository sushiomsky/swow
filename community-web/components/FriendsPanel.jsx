'use client';

import { useEffect, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

export default function FriendsPanel() {
  const [friends, setFriends] = useState([]);
  const [friendId, setFriendId] = useState('');
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();

  const load = async () => {
    try {
      if (!isAuthenticated) {
        setFriends([]);
        setStatus('Melde dich an, um Freunde zu verwalten.');
        return;
      }
      const rows = await api.listFriends();
      setFriends(rows || []);
      setStatus('');
    } catch (error) {
      setStatus(toUserErrorMessage(error, 'Freunde konnten nicht geladen werden.'));
    }
  };

  useEffect(() => { load(); }, [isAuthenticated, api]);

  const sendRequest = async () => {
    try {
      if (!isAuthenticated) {
        setStatus('Melde dich an, um Freundschaftsanfragen zu senden.');
        return;
      }
      await api.sendFriendRequest(friendId);
      setStatus('Anfrage gesendet.');
      setFriendId('');
      await load();
    } catch (error) {
      setStatus(toUserErrorMessage(error, 'Anfrage fehlgeschlagen.'));
    }
  };

  return (
    <section className="card space-y-3">
      <h3 className="text-lg font-semibold">Freunde</h3>
      <div className="flex gap-2">
        <input value={friendId} onChange={(e) => setFriendId(e.target.value)} placeholder="Benutzername des Freunds" aria-label="Benutzername des Freunds" className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={sendRequest}>Hinzufügen</button>
      </div>
      <ul className="space-y-2 text-sm">
        {friends.map((f) => (
          <li key={f.friend_id} className="rounded border border-zinc-700 p-2">
            {(f.display_name || f.username)} <span className="text-zinc-500">({f.status})</span>
          </li>
        ))}
        {friends.length === 0 && <li className="text-zinc-400">Noch keine Freunde.</li>}
      </ul>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </section>
  );
}
