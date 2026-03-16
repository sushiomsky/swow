export default function ProfileCard({ profile }) {
  const topTitle = Array.isArray(profile.achievements) && profile.achievements.length > 0
    ? profile.achievements[profile.achievements.length - 1]
    : null;
  return (
    <section className="card">
      <div className="flex items-center gap-4">
        <img
          src={profile.avatar_url || 'https://placehold.co/72x72'}
          alt="avatar"
          className="h-[72px] w-[72px] rounded-full border border-zinc-700"
        />
        <div>
          <h2 className="text-xl font-semibold">{profile.display_name || profile.username}</h2>
          <p className="text-sm text-zinc-400">@{profile.username}</p>
          <p className="text-sm">Level {profile.level} • XP {profile.xp}</p>
          {topTitle && <p className="text-xs text-amber-300">Top title: {topTitle}</p>}
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-300">{profile.bio || 'No bio yet.'}</p>
    </section>
  );
}
