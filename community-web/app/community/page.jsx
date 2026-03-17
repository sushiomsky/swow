import Link from 'next/link';
import FeatureGrid from '../../components/FeatureGrid';
import CTASection from '../../components/CTASection';

export const metadata = {
  title: 'Landing',
  description: 'Official community hub for Wizard of Wor: rankings, clans, events, and support.',
  alternates: { canonical: '/community' }
};

export default function CommunityLandingPage() {
  return (
    <div className="space-y-10">
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-12">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          Classic arcade gameplay • Modern community features
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Wizard of Wor Community & Competitive Hub
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">
          Play the original-style dungeon action, then level up your profile with ranked seasons, clan competitions,
          daily objectives, and real-time social features.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/multiplayer.html" className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold">Play Now</a>
          <Link href="/community/features" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">Explore Features</Link>
          <Link href="/community/leaderboards" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">View Leaderboards</Link>
          <Link href="/community/forum" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">Join Forum</Link>
        </div>
      </section>

      <FeatureGrid />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <h2 className="text-xl font-semibold">Trusted & Transparent</h2>
          <p className="mt-2 text-sm text-zinc-300">Clear privacy and terms pages support user trust and ad platform requirements.</p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/community/privacy-policy">Privacy Policy</Link>
            <Link href="/community/terms-of-service">Terms</Link>
          </div>
        </article>
        <article className="card">
          <h2 className="text-xl font-semibold">Community Support</h2>
          <p className="mt-2 text-sm text-zinc-300">Need help with account, moderation, or events? Reach out directly.</p>
          <div className="mt-3 text-sm">
            <Link href="/community/contact">Contact Support</Link>
          </div>
        </article>
        <article className="card">
          <h2 className="text-xl font-semibold">Advertiser Friendly</h2>
          <p className="mt-2 text-sm text-zinc-300">Informational content, clear ownership info, and policy pages across the site.</p>
          <div className="mt-3 text-sm">
            <Link href="/community/about">About Project</Link>
          </div>
        </article>
      </section>

      <CTASection />
    </div>
  );
}
