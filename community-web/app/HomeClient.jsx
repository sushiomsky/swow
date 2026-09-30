'use client';

import Link from 'next/link';
import AuthPanel from '../components/AuthPanel';
import ChatRoom from '../components/ChatRoom';
import ActiveGamesPanel from '../components/ActiveGamesPanel';
import { GAME_URLS } from '../lib/gameLinks';
import { useLocale } from '../providers/LocaleProvider';

const T = {
  de: {
    badge: 'Klassische Dungeons · Live-Wettkampf · Community-Plattform',
    title: 'Wizard of Wor Platform',
    intro: 'Gameplay, Profile, Bestenlisten, Clans, Forum, Herausforderungen und Echtzeit-Chat — alles an einem Ort.',
    play: 'Jetzt spielen',
    spectate: 'Zuschauen',
    authHint: 'Neu hier?',
    authCta: 'Kostenlos registrieren',
    leaderboards: 'Bestenlisten',
    community: 'Community',
    links: [
      { title: 'Bestenlisten', href: '/community/leaderboards', description: 'Globale und Freundes-Ranglisten.' },
      { title: 'Clans', href: '/community/clans', description: 'Teams gründen und gemeinsam aufsteigen.' },
      { title: 'Forum', href: '/community/forum', description: 'Strategie, Mitspieler, Diskussion.' },
      { title: 'Sozial', href: '/community/social', description: 'Freunde, Mitteilungen, Aktivität.' }
    ],
    chat: 'Globaler Chat'
  },
  en: {
    badge: 'Classic dungeons · Live competition · Community platform',
    title: 'Wizard of Wor Platform',
    intro: 'Gameplay, profiles, leaderboards, clans, forum, challenges and realtime chat — all in one place.',
    play: 'Play now',
    spectate: 'Spectate',
    authHint: 'New here?',
    authCta: 'Register for free',
    leaderboards: 'Leaderboards',
    community: 'Community',
    links: [
      { title: 'Leaderboards', href: '/community/leaderboards', description: 'Global and friends rankings.' },
      { title: 'Clans', href: '/community/clans', description: 'Found teams and climb together.' },
      { title: 'Forum', href: '/community/forum', description: 'Strategy, teammates, discussion.' },
      { title: 'Social', href: '/community/social', description: 'Friends, notifications, activity.' }
    ],
    chat: 'Global Chat'
  }
};

export default function HomePage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-8">

      {/* Hero */}
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-10">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          {t.badge}
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          {t.intro}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href={GAME_URLS.multiplayer} className="rounded bg-indigo-600 px-6 py-3 text-base font-bold text-white hover:bg-indigo-500">{t.play}</a>
          <a href={GAME_URLS.spectate} className="text-sm font-medium text-indigo-300 hover:text-indigo-200 hover:underline">{t.spectate} →</a>
          <Link href="/community/leaderboards" className="rounded border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800">{t.leaderboards}</Link>
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          {t.authHint}{' '}
          <a href="#konto" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">{t.authCta}</a>
        </p>
      </section>

      {/* Live Games — prominent */}
      <ActiveGamesPanel />

      {/* Community-Bereiche */}
      <section>
        <h2 className="mb-3 text-lg font-bold">{t.community}</h2>
        <div className="grid grid-cols-2 gap-3">
          {t.links.map((l) => (
            <Link key={l.title} href={l.href} className="card">
              <h3 className="text-sm font-semibold">{l.title}</h3>
              <p className="mt-1 text-xs text-zinc-400">{l.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Anmeldung + Globaler Chat */}
      <section id="konto" className="grid scroll-mt-24 gap-4 lg:grid-cols-[360px_1fr]">
        <AuthPanel />
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">{t.chat}</h2>
          <ChatRoom roomType="global" roomId="lobby" />
        </div>
      </section>
    </div>
  );
}
