export default function ProfileCard({ profile }) {
  const topTitle = Array.isArray(profile.achievements) && profile.achievements.length > 0
    ? profile.achievements[profile.achievements.length - 1]
    : null;
  // F3: Profil-Fallback — Username statt 'Unknown', Initialen-Avatar statt Platzhalter-Bild.
  const name = profile.display_name || profile.username || 'Spieler';
  const initial = String(name).trim().charAt(0).toUpperCase() || '?';
  return (
    <section className="card">
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Avatar von ${name}`}
            className="h-[72px] w-[72px] rounded-full border border-zinc-700"
          />
        ) : (
          <div
            aria-label={`Avatar von ${name}`}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-zinc-700 bg-indigo-600 text-3xl font-bold text-white"
          >
            {initial}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-sm text-zinc-400">@{profile.username}</p>
          <p className="text-sm">Level {profile.level} • XP {profile.xp}</p>
          {topTitle && <p className="text-xs text-amber-300">Top title: {topTitle}</p>}
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-300">{profile.bio || 'No bio yet.'}</p>
    </section>
  );
}
