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
        setStatus('Sign in required.');
        return;
      }
      await api.joinClan(clanId);
      setStatus('Joined clan.');
    } catch (error) {
      setStatus(toUserErrorMessage(error, 'Join failed.'));
    }
  };

  const leave = async () => {
    try {
      if (!isAuthenticated) {
        setStatus('Sign in required.');
        return;
      }
      await api.leaveClan();
      setStatus('Left clan.');
    } catch (error) {
      setStatus(toUserErrorMessage(error, 'Leave failed.'));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={join}>Join</button>
      <button className="rounded border border-zinc-700 px-3 py-2 text-sm" onClick={leave}>Leave</button>
      {status && <span className="text-xs text-zinc-400">{status}</span>}
    </div>
  );
}
