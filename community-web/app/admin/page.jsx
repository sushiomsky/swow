'use client';

import { useEffect, useState } from 'react';
import AdminConsole from '../../components/AdminConsole';
import { useCommunitySession } from '../../providers/CommunitySessionProvider';

export default function AdminPage() {
  const { api, isAuthenticated, user, ready } = useCommunitySession();
  const [analytics, setAnalytics] = useState({ dau: 0, wau: 0, mau: 0 });
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAuthenticated) {
      setAnalytics({ dau: 0, wau: 0, mau: 0 });
      return;
    }

    api.getAdminAnalytics()
      .then((data) => {
        setAnalytics({
          dau: data?.dau ?? 0,
          wau: data?.wau ?? 0,
          mau: data?.mau ?? 0
        });
      })
      .catch(() => {
        setAnalytics({ dau: 0, wau: 0, mau: 0 });
      });
  }, [api, isAuthenticated]);

  // M5: login gate — never render a zeroed dashboard to anonymous visitors.
  if (!ready) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin-Bereich</h1>
        <section className="card"><p className="text-sm text-zinc-400">Wird geladen…</p></section>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin-Bereich</h1>
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">Geschützter Bereich</h2>
          <p className="text-sm text-zinc-300">
            {!isAuthenticated
              ? 'Melde dich mit einem Admin-Konto an für Moderation und Statistiken.'
              : 'Dein Konto hat keine Admin-Rechte.'}
          </p>
          {!isAuthenticated && (
            <p className="mt-2 text-xs text-zinc-400">
              Nutze die Anmeldung auf der Startseite und komm dann hierher zurück.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin-Bereich</h1>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="card"><p className="text-zinc-400">DAU</p><p className="text-3xl font-semibold">{analytics.dau}</p></div>
        <div className="card"><p className="text-zinc-400">WAU</p><p className="text-3xl font-semibold">{analytics.wau}</p></div>
        <div className="card"><p className="text-zinc-400">MAU</p><p className="text-3xl font-semibold">{analytics.mau}</p></div>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Moderations-Werkzeuge</h2>
        <p className="text-sm text-zinc-300">Suche, Stummschalten, Sperren und Meldungen über <code>/api/community/admin</code>.</p>
      </section>
      <AdminConsole />
    </div>
  );
}
