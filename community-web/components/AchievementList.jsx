export default function AchievementList({ achievements = [], badges = [] }) {
  return (
    <section className="card">
      <h3 className="mb-3 text-lg font-semibold">Achievements & Titles</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {achievements.map((item) => (
          <span key={item} className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs">
            {item}
          </span>
        ))}
        {achievements.length === 0 && <span className="text-sm text-zinc-400">No achievements yet.</span>}
      </div>
      <h4 className="mb-2 text-sm font-semibold text-zinc-300">Seasonal Badges</h4>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={`${badge.season}-${badge.badge}`} className="rounded border border-indigo-500/50 bg-indigo-500/10 px-2 py-1 text-xs">
            {badge.season}: {badge.badge}
          </span>
        ))}
        {badges.length === 0 && <span className="text-sm text-zinc-500">No seasonal badges yet.</span>}
      </div>
    </section>
  );
}
