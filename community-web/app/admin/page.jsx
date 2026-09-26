'use client';

import { useEffect, useState } from 'react';
import AdminConsole from '../../components/AdminConsole';
import { useCommunitySession } from '../../providers/CommunitySessionProvider';
import { useLocale } from '../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Admin-Bereich',
    loading: 'Wird geladen…',
    protectedTitle: 'Geschützter Bereich',
    needLogin: 'Melde dich mit einem Admin-Konto an für Moderation und Statistiken.',
    noRights: 'Dein Konto hat keine Admin-Rechte.',
    loginHint: 'Nutze die Anmeldung auf der Startseite und komm dann hierher zurück.',
    toolsTitle: 'Moderations-Werkzeuge',
    toolsIntro: 'Suche, Stummschalten, Sperren und Meldungen über'
  },
  en: {
    title: 'Admin area',
    loading: 'Loading…',
    protectedTitle: 'Restricted area',
    needLogin: 'Sign in with an admin account for moderation and statistics.',
    noRights: 'Your account has no admin rights.',
    loginHint: 'Use the sign-in on the start page and come back here afterwards.',
    toolsTitle: 'Moderation tools',
    toolsIntro: 'Search, mute, ban and reports via'
  }
};

export default function AdminPage() {
  const { api, isAuthenticated, user, ready } = useCommunitySession();
  const { locale } = useLocale();
  const t = T[locale] || T.de;
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
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <section className="card"><p className="text-sm text-zinc-400">{t.loading}</p></section>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">{t.protectedTitle}</h2>
          <p className="text-sm text-zinc-300">
            {!isAuthenticated
              ? t.needLogin
              : t.noRights}
          </p>
          {!isAuthenticated && (
            <p className="mt-2 text-xs text-zinc-400">
              {t.loginHint}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="card"><p className="text-zinc-400">DAU</p><p className="text-3xl font-semibold">{analytics.dau}</p></div>
        <div className="card"><p className="text-zinc-400">WAU</p><p className="text-3xl font-semibold">{analytics.wau}</p></div>
        <div className="card"><p className="text-zinc-400">MAU</p><p className="text-3xl font-semibold">{analytics.mau}</p></div>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">{t.toolsTitle}</h2>
        <p className="text-sm text-zinc-300">{t.toolsIntro} <code>/api/community/admin</code>.</p>
      </section>
      <AdminConsole />
    </div>
  );
}
