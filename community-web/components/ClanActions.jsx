'use client';

import { useState } from 'react';
import { apiSend } from '../lib/api';

export default function ClanActions({ clanId }) {
  const [status, setStatus] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('communityToken') : null;

  const join = async () => {
    try {
      await apiSend(`/clans/${clanId}/join`, 'POST', {}, token);
      setStatus('Joined clan.');
    } catch (_) {
      setStatus('Join failed.');
    }
  };

  const leave = async () => {
    try {
      await apiSend('/clans/leave', 'POST', {}, token);
      setStatus('Left clan.');
    } catch (_) {
      setStatus('Leave failed.');
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
