'use client';

import LeaderboardView from '../../../components/LeaderboardView';
import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: { title: 'Bestenlisten' },
  en: { title: 'Leaderboards' }
};

export default function LeaderboardsPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <LeaderboardView />
    </div>
  );
}
