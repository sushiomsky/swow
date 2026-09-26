export default function AchievementList({ achievements = [], badges = [] }) {
  return (
    <section className="card">
      <h3 className="mb-3 text-lg font-semibold">Erfolge & Titel</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {achievements.map((item) => (
          <span key={item} className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs">
            {item}
          </span>
        ))}
        {achievements.length === 0 && <span className="text-sm text-zinc-400">Noch keine Erfolge.</span>}
      </div>
      <h4 className="mb-2 text-sm font-semibold text-zinc-300">Saison-Abzeichen</h4>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={`${badge.season}-${badge.badge}`} className="rounded border border-indigo-500/50 bg-indigo-500/10 px-2 py-1 text-xs">
            {badge.season}: {badge.badge}
          </span>
        ))}
        {badges.length === 0 && <span className="text-sm text-zinc-500">Noch keine Saison-Abzeichen.</span>}
      </div>
    </section>
  );
}
