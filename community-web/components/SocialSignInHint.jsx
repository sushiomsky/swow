'use client';

import Link from 'next/link';
import { useCommunitySession } from '../providers/CommunitySessionProvider';

// M4 follow-up: explain logged-out empty state on /community/social with a
// sign-in CTA instead of bare "No friends yet" panels.
export default function SocialSignInHint() {
  const { isAuthenticated, ready } = useCommunitySession();
  if (!ready || isAuthenticated) return null;
  return (
    <section className="card border-indigo-500/30 bg-indigo-500/5 md:col-span-2">
      <h2 className="text-lg font-semibold">Sign in to use Social</h2>
      <p className="mt-1 text-sm text-zinc-300">
        Friends, friend requests, and notifications require an account.
        Sign in on the home page, then come back here to connect with other players.
      </p>
      <Link
        href="/"
        className="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Go to sign-in →
      </Link>
    </section>
  );
}
