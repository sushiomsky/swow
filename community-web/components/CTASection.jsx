'use client';

import { GAME_URLS } from '../lib/gameLinks';
import { useLocale } from '../providers/LocaleProvider';

const T = {
  de: {
    title: 'Bereit zum Spielen?',
    intro: 'Steig ein und klettere mit deinem Clan die Rangliste hoch.',
    play: 'Jetzt spielen',
    classic: 'Klassik spielen'
  },
  en: {
    title: 'Ready to play?',
    intro: 'Jump in and climb the ranks with your clan.',
    play: 'Play now',
    classic: 'Play classic'
  }
};

export default function CTASection() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <section className="card flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-zinc-300">
          {t.intro}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={GAME_URLS.multiplayer} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">{t.play}</a>
        <a href={GAME_URLS.classic} className="rounded border border-zinc-600 px-4 py-2 text-sm font-semibold">{t.classic}</a>
      </div>
    </section>
  );
}
