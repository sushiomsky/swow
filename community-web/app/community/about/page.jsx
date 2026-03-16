export const metadata = {
  title: 'About',
  description: 'Learn about the Wizard of Wor community platform, mission, and moderation principles.'
};

export default function AboutPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">About Wizard of Wor Community</h1>
      <section className="card space-y-3 text-sm text-zinc-300">
        <p>
          Wizard of Wor Community is a social and competitive layer built around the classic-style arcade gameplay.
          The gameplay core remains untouched; community features are isolated in dedicated services.
        </p>
        <p>
          We focus on fair competition, transparent moderation, and meaningful progression through seasons, challenges,
          and player profiles.
        </p>
      </section>
      <section className="card space-y-2 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">What we provide</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Public profiles, clan pages, and rank tracking</li>
          <li>Real-time chat and event notifications</li>
          <li>Moderation workflow for reports and abuse handling</li>
          <li>Analytics tools for healthy community operations</li>
        </ul>
      </section>
    </div>
  );
}
