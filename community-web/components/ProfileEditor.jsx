'use client';

import { useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

const STRINGS = {
  de: {
    editProfile: 'Profil bearbeiten',
    displayName: 'Anzeigename',
    avatarUrl: 'Avatar-URL',
    aboutMe: 'Über mich',
    save: 'Speichern',
    signInToEdit: 'Melde dich an, um dein Profil zu ändern.',
    saved: 'Profil gespeichert.',
    saveFailed: 'Speichern fehlgeschlagen.'
  },
  en: {
    editProfile: 'Edit profile',
    displayName: 'Display name',
    avatarUrl: 'Avatar URL',
    aboutMe: 'About me',
    save: 'Save',
    signInToEdit: 'Sign in to edit your profile.',
    saved: 'Profile saved.',
    saveFailed: 'Save failed.'
  }
};

export default function ProfileEditor({ profile }) {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();

  const save = async () => {
    try {
      if (!isAuthenticated) {
        setStatus(t.signInToEdit);
        return;
      }
      await api.updateProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
        bio
      });
      setStatus(t.saved);
    } catch (e) {
      setStatus(toUserErrorMessage(e, t.saveFailed));
    }
  };

  return (
    <section className="card space-y-3">
      <h3 className="text-lg font-semibold">{t.editProfile}</h3>
      <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t.displayName} aria-label={t.displayName} />
      <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder={t.avatarUrl} aria-label={t.avatarUrl} />
      <textarea className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t.aboutMe} aria-label={t.aboutMe} rows={4} />
      <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold" onClick={save}>{t.save}</button>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </section>
  );
}
