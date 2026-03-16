export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for the Wizard of Wor community platform.'
};

export default function TermsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <section className="card space-y-3 text-sm text-zinc-300">
        <p>
          By using this platform, you agree to fair-play and anti-harassment rules. Abuse, cheating tools, and
          disruptive behavior may result in mute, suspension, or ban.
        </p>
        <p>
          We may update seasonal formats, ranking logic presentation, and community features without changing the core
          game mechanics.
        </p>
        <p>
          Continued use after policy updates constitutes acceptance of revised terms.
        </p>
      </section>
    </div>
  );
}
