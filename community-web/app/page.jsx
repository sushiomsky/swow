import Link from 'next/link';
import AuthPanel from '../components/AuthPanel';
import ChatRoom from '../components/ChatRoom';
import ActiveGamesPanel from '../components/ActiveGamesPanel';

const MULTIPLAYER_MODES = [
  { title: 'Endless BR', href: '/multiplayer.html?mode=endless', description: 'Drop in and battle across connected dungeons, anytime.' },
  { title: 'Sit-n-Go BR', href: '/multiplayer.html?mode=sitngo', description: 'Queue up and launch once enough players are ready.' },
  { title: 'Team Endless BR', href: '/multiplayer.html?mode=team', description: 'Gold vs Blue team battles across linked dungeons.' },
  { title: 'Team Sit-n-Go BR', href: '/multiplayer.html?mode=team-sitngo', description: 'Organized team match — queue, fill, fight.' },
  { title: 'Private Room', href: '/multiplayer.html?mode=pair-host', description: 'Create a private classic room and share the code.' },
];

const CLASSIC_MODES = [
  { title: 'Classic Solo', href: '/index.html', description: 'Original arcade action for one player.' },
  { title: 'Classic Local 2P', href: '/index.html', description: 'Two players on one keyboard (press 2 on title screen).' },
];

const COMMUNITY_LINKS = [
  { title: 'Leaderboards', href: '/community/leaderboards', description: 'Global and friends rankings.' },
  { title: 'Challenges', href: '/community/challenges', description: 'Daily and seasonal goals.' },
  { title: 'Forum', href: '/community/forum', description: 'Strategy, teammates, discussion.' },
  { title: 'Social', href: '/community/social', description: 'Friends, notifications, activity.' },
];

export const metadata = {
  title: 'Home',
  description: 'Wizard of Wor platform with classic gameplay, community features, account access, and live global chat.'
};

export default function HomePage() {
  return (
    <div className="space-y-8">

      {/* Hero */}
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-10">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          Classic dungeons · Live competition · Community platform
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Wizard of Wor Platform
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Gameplay, profiles, leaderboards, clans, forum, challenges, and real-time social — all in one place.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/multiplayer.html" className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Play Multiplayer</a>
          <a href="/index.html" className="rounded border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800">Play Classic</a>
          <Link href="/community/leaderboards" className="rounded border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800">Leaderboards</Link>
        </div>
      </section>

      {/* Live Games — prominent, action-oriented */}
      <ActiveGamesPanel />

      {/* Game modes + community features side by side */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Multiplayer modes */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Multiplayer Modes</h2>
          <div className="space-y-2">
            {MULTIPLAYER_MODES.map((m) => (
              <a key={m.title} href={m.href} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:bg-zinc-800">
                <div>
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="text-xs text-zinc-400">{m.description}</p>
                </div>
                <span className="ml-4 shrink-0 text-xs text-zinc-500">Play →</span>
              </a>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-lg font-bold">Classic Modes</h2>
          <div className="space-y-2">
            {CLASSIC_MODES.map((m) => (
              <a key={m.title} href={m.href} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:bg-zinc-800">
                <div>
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="text-xs text-zinc-400">{m.description}</p>
                </div>
                <span className="ml-4 shrink-0 text-xs text-zinc-500">Play →</span>
              </a>
            ))}
          </div>
        </section>

        {/* Community features */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Community</h2>
          <div className="grid grid-cols-2 gap-3">
            {COMMUNITY_LINKS.map((l) => (
              <Link key={l.title} href={l.href} className="card">
                <h3 className="text-sm font-semibold">{l.title}</h3>
                <p className="mt-1 text-xs text-zinc-400">{l.description}</p>
              </Link>
            ))}
            <Link href="/community/forum" className="card col-span-2">
              <h3 className="text-sm font-semibold">Forum &amp; Chat</h3>
              <p className="mt-1 text-xs text-zinc-400">Discuss, find teammates, and stay connected with the community.</p>
            </Link>
          </div>
        </section>
      </div>

      {/* Auth + Global Chat */}
      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <AuthPanel />
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Global Chat</h2>
          <ChatRoom roomType="global" roomId="lobby" />
        </div>
      </section>
    </div>
  );
}
