'use client';

import { useLocale } from '../providers/LocaleProvider';

const T = {
  de: {
    title: 'Erfolge & Titel',
    badges: 'Saison-Abzeichen',
    noAchievements: 'Noch keine Erfolge.',
    noBadges: 'Noch keine Saison-Abzeichen.'
  },
  en: {
    title: 'Achievements & Titles',
    badges: 'Seasonal Badges',
    noAchievements: 'No achievements yet.',
    noBadges: 'No seasonal badges yet.'
  }
};

export default function AchievementList({ achievements = [], badges = [] }) {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <section className="card">
      <h3 className="mb-3 text-lg font-semibold">{t.title}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {achievements.map((item) => (
          <span key={item} className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs">
            {item}
          </span>
        ))}
        {achievements.length === 0 && <span className="text-sm text-zinc-400">{t.noAchievements}</span>}
      </div>
      <h4 className="mb-2 text-sm font-semibold text-zinc-300">{t.badges}</h4>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={`${badge.season}-${badge.badge}`} className="rounded border border-indigo-500/50 bg-indigo-500/10 px-2 py-1 text-xs">
            {badge.season}: {badge.badge}
          </span>
        ))}
        {badges.length === 0 && <span className="text-sm text-zinc-500">{t.noBadges}</span>}
      </div>
    </section>
  );
}
