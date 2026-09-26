import Link from 'next/link';
import AuthPanel from '../components/AuthPanel';
import ChatRoom from '../components/ChatRoom';
import ActiveGamesPanel from '../components/ActiveGamesPanel';
import { GAME_URLS } from '../lib/gameLinks';

const COMMUNITY_LINKS = [
  { title: 'Bestenlisten', href: '/community/leaderboards', description: 'Globale und Freundes-Ranglisten.' },
  { title: 'Clans', href: '/community/clans', description: 'Teams gründen und gemeinsam aufsteigen.' },
  { title: 'Forum', href: '/community/forum', description: 'Strategie, Mitspieler, Diskussion.' },
  { title: 'Sozial', href: '/community/social', description: 'Freunde, Mitteilungen, Aktivität.' },
];

export const metadata = {
  title: 'Start',
  description: 'Wizard of Wor Plattform: klassisches Gameplay, Community-Funktionen, Konto und Live-Chat.'
};

export default function HomePage() {
  return (
    <div className="space-y-8">

      {/* Hero */}
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-10">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          Klassische Dungeons · Live-Wettkampf · Community-Plattform
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Wizard of Wor Platform
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Gameplay, Profile, Bestenlisten, Clans, Forum, Herausforderungen und Echtzeit-Chat — alles an einem Ort.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={GAME_URLS.multiplayer} className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Jetzt spielen</a>
          <Link href="/community/leaderboards" className="rounded border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800">Bestenlisten</Link>
        </div>
      </section>

      {/* Live Games — prominent */}
      <ActiveGamesPanel />

      {/* Community-Bereiche */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Community</h2>
        <div className="grid grid-cols-2 gap-3">
          {COMMUNITY_LINKS.map((l) => (
            <Link key={l.title} href={l.href} className="card">
              <h3 className="text-sm font-semibold">{l.title}</h3>
              <p className="mt-1 text-xs text-zinc-400">{l.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Anmeldung + Globaler Chat */}
      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <AuthPanel />
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Globaler Chat</h2>
          <ChatRoom roomType="global" roomId="lobby" />
        </div>
      </section>
    </div>
  );
}
