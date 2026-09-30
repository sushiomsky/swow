'use client';

import Link from 'next/link';
import FeatureGrid from '../../components/FeatureGrid';
import CTASection from '../../components/CTASection';
import { GAME_URLS } from '../../lib/gameLinks';
import { useLocale } from '../../providers/LocaleProvider';

const T = {
  de: {
    badge: 'Klassisches Arcade-Gameplay • Moderne Community',
    title: 'Wizard of Wor Community',
    intro: 'Spiele im klassischen Dungeon-Stil und baue dein Profil aus: Saison-Ranglisten, Clan-Wettkämpfe, tägliche Ziele und Echtzeit-Chat.',
    play: 'Jetzt spielen',
    spectate: 'Zuschauen',
    authCta: 'Konto erstellen und Fortschritt sichern →',
    boards: 'Bestenlisten ansehen',
    forum: 'Forum besuchen'
  },
  en: {
    badge: 'Classic arcade gameplay • Modern community',
    title: 'Wizard of Wor Community',
    intro: 'Play classic-style dungeon action and grow your profile: season rankings, clan competitions, daily goals and realtime chat.',
    play: 'Play now',
    spectate: 'Spectate',
    authCta: 'Create an account and save progress →',
    boards: 'View leaderboards',
    forum: 'Visit forum'
  }
};

export default function CommunityLandingClient() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-10">
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-12">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          {t.badge}
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">
          {t.intro}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={GAME_URLS.multiplayer} className="rounded bg-indigo-600 px-6 py-3 text-base font-bold">{t.play}</a>
          <a href={GAME_URLS.spectate} className="text-sm font-medium text-indigo-300 hover:text-indigo-200 hover:underline">{t.spectate} →</a>
          <Link href="/community/leaderboards" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">{t.boards}</Link>
          <Link href="/community/forum" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">{t.forum}</Link>
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          <Link href="/" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">{t.authCta}</Link>
        </p>
      </section>

      <FeatureGrid />

      <CTASection />
    </div>
  );
}
