import Link from 'next/link';
import AuthPanel from '../components/AuthPanel';
import ChatRoom from '../components/ChatRoom';
import ActiveGamesPanel from '../components/ActiveGamesPanel';

const GAME_MODES = [
  {
    title: 'Classic Solo',
    href: '/index.html',
    description: 'Original arcade run for one player.'
  },
  {
    title: 'Classic Local 2P',
    href: '/index.html',
    description: 'Start two-player from the title screen (press 2).'
  },
  {
    title: 'Endless BR',
    href: '/multiplayer.html?mode=endless',
    description: 'Join connected dungeon battles instantly.'
  },
  {
    title: 'Sit-n-Go BR',
    href: '/multiplayer.html?mode=sitngo',
    description: 'Queue and launch once enough players join.'
  },
  {
    title: 'Team BR',
    href: '/multiplayer.html?mode=team',
    description: 'Auto-balanced gold vs blue team battle royale.'
  },
  {
    title: 'Private Classic Host',
    href: '/multiplayer.html?mode=pair-host',
    description: 'Create a private classic room and share the code.'
  },
  {
    title: 'Private Classic Join',
    href: '/multiplayer.html?mode=pair-join',
    description: 'Join an existing private room with a code.'
  }
];

export const metadata = {
  title: 'Home',
  description: 'Wizard of Wor platform with classic gameplay, community features, account access, and live global chat.'
};

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-12">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          Classic dungeons • Live competition • Community platform
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Wizard of Wor Platform
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">
          One website for gameplay, profiles, leaderboards, clans, forum discussions, challenges, and real-time social features.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/index.html" className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold">Play Classic</a>
          <a href="/multiplayer.html" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">Play Multiplayer</a>
          <Link href="/community" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">Community Hub</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/community/leaderboards" className="card"><h2 className="text-lg font-semibold">Leaderboards</h2><p className="mt-2 text-sm text-zinc-300">Global, regional, and friends rankings.</p></Link>
        <Link href="/community/challenges" className="card"><h2 className="text-lg font-semibold">Challenges</h2><p className="mt-2 text-sm text-zinc-300">Daily and seasonal goals with rewards.</p></Link>
        <Link href="/community/social" className="card"><h2 className="text-lg font-semibold">Social</h2><p className="mt-2 text-sm text-zinc-300">Friends, notifications, and activity feed.</p></Link>
        <Link href="/community/forum" className="card"><h2 className="text-lg font-semibold">Forum</h2><p className="mt-2 text-sm text-zinc-300">Discuss strategy and find teammates.</p></Link>
        <Link href="/community/chat" className="card"><h2 className="text-lg font-semibold">Chat Rooms</h2><p className="mt-2 text-sm text-zinc-300">Global, match, and clan communication.</p></Link>
        <Link href="/admin" className="card"><h2 className="text-lg font-semibold">Admin</h2><p className="mt-2 text-sm text-zinc-300">Moderation, reports, events, analytics.</p></Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">All Game Modes</h2>
        <p className="text-sm text-zinc-300">Launch any mode directly from the website.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_MODES.map((mode) => (
            <a key={mode.title} href={mode.href} className="card">
              <h3 className="text-lg font-semibold">{mode.title}</h3>
              <p className="mt-2 text-sm text-zinc-300">{mode.description}</p>
            </a>
          ))}
        </div>
      </section>

      <ActiveGamesPanel />

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
