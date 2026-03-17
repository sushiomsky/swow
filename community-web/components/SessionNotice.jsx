'use client';

import { useCommunitySession } from '../providers/CommunitySessionProvider';

export default function SessionNotice() {
  const { sessionError, clearSessionError } = useCommunitySession();
  if (!sessionError) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <span>{sessionError}</span>
      <button
        className="rounded border border-amber-300/60 px-2 py-1 text-xs"
        onClick={clearSessionError}
      >
        Dismiss
      </button>
    </div>
  );
}
