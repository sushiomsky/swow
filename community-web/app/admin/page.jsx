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
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <section className="card"><p className="text-sm text-zinc-400">Loading…</p></section>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">Restricted Area</h2>
          <p className="text-sm text-zinc-300">
            {!isAuthenticated
              ? 'Sign in with an admin account to access moderation tools and analytics.'
              : 'Your account does not have admin permissions.'}
          </p>
          {!isAuthenticated && (
            <p className="mt-2 text-xs text-zinc-400">
              Use the sign-in panel on the home page, then return here.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="card"><p className="text-zinc-400">DAU</p><p className="text-3xl font-semibold">{analytics.dau}</p></div>
        <div className="card"><p className="text-zinc-400">WAU</p><p className="text-3xl font-semibold">{analytics.wau}</p></div>
        <div className="card"><p className="text-zinc-400">MAU</p><p className="text-3xl font-semibold">{analytics.mau}</p></div>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Moderation Tools</h2>
        <p className="text-sm text-zinc-300">Search, mute, ban, and report triage APIs are available under <code>/api/community/admin</code>.</p>
      </section>
      <AdminConsole />
    </div>
  );
}
