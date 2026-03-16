import { apiGet } from '../../../lib/api';

export default async function ChallengesPage() {
  const challenges = await apiGet('/challenges').catch(() => []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Challenges & Rewards</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {challenges.map((c) => (
          <article key={c.challenge_id} className="card">
            <h2 className="text-lg font-semibold">{c.description}</h2>
            <p className="text-sm text-zinc-300">Reward: {c.reward}</p>
            <p className="text-xs text-zinc-500">Ends: {new Date(c.end_date).toLocaleString()}</p>
          </article>
        ))}
        {challenges.length === 0 && <p className="text-zinc-400">No active challenges.</p>}
      </div>
    </div>
  );
}
