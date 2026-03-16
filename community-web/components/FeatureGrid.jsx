const FEATURES = [
  { title: 'Ranked Seasons', text: 'Compete on global and regional leaderboards with seasonal resets and rewards.' },
  { title: 'Player Profiles', text: 'Track XP, level progress, badges, recent match results, and personal highlights.' },
  { title: 'Clans & Team Play', text: 'Create or join clans, chat with members, and push team standings together.' },
  { title: 'Daily Challenges', text: 'Complete rotating objectives for cosmetics, titles, and progression boosts.' },
  { title: 'Live Social Layer', text: 'Use global, match, and clan chat with real-time notifications and invites.' },
  { title: 'Fair Moderation', text: 'Admin tools support reports, mute/ban actions, and engagement analytics.' }
];

export default function FeatureGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="card">
          <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
          <p className="text-sm text-zinc-300">{feature.text}</p>
        </article>
      ))}
    </section>
  );
}
