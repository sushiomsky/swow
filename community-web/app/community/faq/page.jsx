const FAQ = [
  {
    q: 'Does the community layer change gameplay mechanics?',
    a: 'No. Core game movement, combat, scoring, enemy behavior, and lifecycle rules are unchanged.'
  },
  {
    q: 'How are ranks calculated?',
    a: 'Rankings are recalculated per season from stored scores and match performance metrics.'
  },
  {
    q: 'Can I play without joining a clan?',
    a: 'Yes. Clans are optional. You can still compete in global and regional leaderboards.'
  },
  {
    q: 'How do I report abusive chat behavior?',
    a: 'Use in-app moderation controls; reports are reviewed by admins through the moderation dashboard.'
  },
  {
    q: 'Where can I find policy pages required for ad compliance?',
    a: 'See the Privacy Policy, Terms of Service, and Contact pages linked in the footer.'
  }
];

export const metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Wizard of Wor community accounts, rankings, and moderation.'
};

export default function FAQPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
      <div className="space-y-3">
        {FAQ.map((item) => (
          <article key={item.q} className="card">
            <h2 className="text-lg font-semibold">{item.q}</h2>
            <p className="mt-2 text-sm text-zinc-300">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
