import Link from 'next/link';
import FeatureGrid from '../../components/FeatureGrid';
import CTASection from '../../components/CTASection';
import { GAME_URLS } from '../../lib/gameLinks';

export const metadata = {
  title: 'Community',
  description: 'Community-Hub für Wizard of Wor: Ranglisten, Clans, Forum und Hilfe.',
  alternates: { canonical: '/community' }
};

export default function CommunityLandingPage() {
  return (
    <div className="space-y-10">
      <section className="hero rounded-2xl border border-zinc-800 p-8 md:p-12">
        <p className="mb-3 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          Klassisches Arcade-Gameplay • Moderne Community
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Wizard of Wor Community
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">
          Spiele im klassischen Dungeon-Stil und baue dein Profil aus: Saison-Ranglisten,
          Clan-Wettkämpfe, tägliche Ziele und Echtzeit-Chat.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={GAME_URLS.multiplayer} className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold">Jetzt spielen</a>
          <Link href="/community/leaderboards" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">Bestenlisten ansehen</Link>
          <Link href="/community/forum" className="rounded border border-zinc-600 px-5 py-3 text-sm font-semibold">Forum besuchen</Link>
        </div>
      </section>

      <FeatureGrid />

      <CTASection />
    </div>
  );
}
