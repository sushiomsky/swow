'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';
import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Herausforderungen & Belohnungen',
    reward: 'Belohnung',
    ends: 'Endet',
    empty: 'Keine aktiven Herausforderungen.',
    locale: 'de-DE'
  },
  en: {
    title: 'Challenges & Rewards',
    reward: 'Reward',
    ends: 'Ends',
    empty: 'No active challenges.',
    locale: 'en-US'
  }
};

export default function ChallengesPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    apiGet('/challenges')
      .then((data) => { if (!cancelled) setChallenges(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setChallenges([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {challenges.map((c) => (
          <article key={c.challenge_id} className="card">
            <h2 className="text-lg font-semibold">{c.description}</h2>
            <p className="text-sm text-zinc-300">{t.reward}: {c.reward}</p>
            <p className="text-xs text-zinc-500">{t.ends}: {new Date(c.end_date).toLocaleString(t.locale)}</p>
          </article>
        ))}
        {challenges.length === 0 && <p className="text-zinc-400">{t.empty}</p>}
      </div>
    </div>
  );
}
