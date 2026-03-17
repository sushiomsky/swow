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
        setStatus('Sign in to update your profile.');
        return;
      }
      await api.updateProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
        bio
      });
      setStatus('Saved profile changes.');
    } catch (e) {
      setStatus(toUserErrorMessage(e, 'Save failed.'));
    }
  };

  return (
    <section className="card space-y-3">
      <h3 className="text-lg font-semibold">Edit Profile</h3>
      <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
      <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar URL" />
      <textarea className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={4} />
      <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold" onClick={save}>Save</button>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </section>
  );
}
