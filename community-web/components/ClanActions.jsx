'use client';

import { useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../lib/errorUtils';

export default function ClanActions({ clanId }) {
  const [status, setStatus] = useState('');
  const { api, isAuthenticated } = useCommunitySession();

  const join = async () => {
    try {
      if (!isAuthenticated) {
        setStatus('Anmeldung erforderlich.');
        return;
      }
      await api.joinClan(clanId);
      setStatus('Clan beigetreten.');
    } catch (error) {
      setStatus(toUserErrorMessage(error, 'Beitreten fehlgeschlagen.'));
    }
  };

  const leave = async () => {
    try {
      if (!isAuthenticated) {
        setStatus('Anmeldung erforderlich.');
        return;
      }
      await api.leaveClan();
      setStatus('Clan verlassen.');
    } catch (error) {
      setStatus(toUserErrorMessage(error, 'Verlassen fehlgeschlagen.'));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={join}>Beitreten</button>
      <button className="rounded border border-zinc-700 px-3 py-2 text-sm" onClick={leave}>Verlassen</button>
      {status && <span className="text-xs text-zinc-400">{status}</span>}
    </div>
  );
}
