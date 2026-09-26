'use client';

import { useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

const STRINGS = {
  de: {
    join: 'Beitreten',
    leave: 'Verlassen',
    authRequired: 'Anmeldung erforderlich.',
    joined: 'Clan beigetreten.',
    left: 'Clan verlassen.',
    joinFailed: 'Beitreten fehlgeschlagen.',
    leaveFailed: 'Verlassen fehlgeschlagen.'
  },
  en: {
    join: 'Join',
    leave: 'Leave',
    authRequired: 'Sign-in required.',
    joined: 'Joined clan.',
    left: 'Left clan.',
    joinFailed: 'Join failed.',
    leaveFailed: 'Leave failed.'
  }
};

export default function ClanActions({ clanId }) {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();

  const join = async () => {
    try {
      if (!isAuthenticated) {
        setStatus(t.authRequired);
        return;
      }
      await api.joinClan(clanId);
      setStatus(t.joined);
    } catch (error) {
      setStatus(toUserErrorMessage(error, t.joinFailed));
    }
  };

  const leave = async () => {
    try {
      if (!isAuthenticated) {
        setStatus(t.authRequired);
        return;
      }
      await api.leaveClan();
      setStatus(t.left);
    } catch (error) {
      setStatus(toUserErrorMessage(error, t.leaveFailed));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={join}>{t.join}</button>
      <button className="rounded border border-zinc-700 px-3 py-2 text-sm" onClick={leave}>{t.leave}</button>
      {status && <span className="text-xs text-zinc-400">{status}</span>}
    </div>
  );
}
