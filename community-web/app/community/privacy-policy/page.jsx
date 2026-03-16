export const metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Wizard of Wor Community platform services.'
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <section className="card space-y-3 text-sm text-zinc-300">
        <p>
          We collect account and gameplay-adjacent metadata needed to provide community functionality (profiles,
          rankings, challenges, moderation, and notifications).
        </p>
        <p>
          We do not alter in-match game mechanics through community data. Data usage is limited to platform operations,
          abuse prevention, and service improvement.
        </p>
        <p>
          You may request account data review or deletion by contacting support. Some moderation and legal records may
          be retained as required by policy.
        </p>
      </section>
    </div>
  );
}
