'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCommunitySession } from '../../../providers/CommunitySessionProvider';

// N3 follow-up: `/community/profile` short route (previously Next-404).
// Signed-in users are forwarded to their own profile page; guests get a
// sign-in hint instead of a 404.
export default function OwnProfilePage() {
  const router = useRouter();
  const { isAuthenticated, ready, user } = useCommunitySession();

  useEffect(() => {
    if (ready && isAuthenticated && user?.username) {
      router.replace(`/community/profile/${encodeURIComponent(user.username)}`);
    }
  }, [ready, isAuthenticated, user, router]);

  if (!ready) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-400">Wird geladen…</p>
      </section>
    );
  }

  if (isAuthenticated) return null;

  return (
    <section className="card border-indigo-500/30 bg-indigo-500/5">
      <h1 className="text-lg font-semibold">Melde dich an für dein Profil</h1>
      <p className="mt-1 text-sm text-zinc-300">
        Dein Profil liegt auf deiner Benutzerseite. Melde dich zuerst auf der Startseite an —
        danach wirst du automatisch weitergeleitet.
      </p>
      <Link
        href="/"
        className="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Zur Anmeldung →
      </Link>
    </section>
  );
}
