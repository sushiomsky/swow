'use client';

import { useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

export default function ProfileEditor({ profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();

  const save = async () => {
    try {
      if (!isAuthenticated) {
        setStatus('Melde dich an, um dein Profil zu ändern.');
        return;
      }
      await api.updateProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
        bio
      });
      setStatus('Profil gespeichert.');
    } catch (e) {
      setStatus(toUserErrorMessage(e, 'Speichern fehlgeschlagen.'));
    }
  };

  return (
    <section className="card space-y-3">
      <h3 className="text-lg font-semibold">Profil bearbeiten</h3>
      <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Anzeigename" aria-label="Anzeigename" />
      <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar-URL" aria-label="Avatar-URL" />
      <textarea className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Über mich" aria-label="Über mich" rows={4} />
      <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold" onClick={save}>Speichern</button>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </section>
  );
}
