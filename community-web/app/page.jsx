import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Wizard of Wor Community Layer</h1>
      <p className="text-zinc-300">Social, competitive, and moderation interfaces.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Link className="card hover:border-indigo-500" href="/community/leaderboards">Leaderboards</Link>
        <Link className="card hover:border-indigo-500" href="/community/profile/demo">Player Profile</Link>
        <Link className="card hover:border-indigo-500" href="/community/clans/1">Clan Page</Link>
        <Link className="card hover:border-indigo-500" href="/community/challenges">Challenges</Link>
        <Link className="card hover:border-indigo-500" href="/admin">Admin Dashboard</Link>
      </div>
    </div>
  );
}
