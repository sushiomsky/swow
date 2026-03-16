import FeatureGrid from '../../../components/FeatureGrid';
import CTASection from '../../../components/CTASection';

export const metadata = {
  title: 'Features',
  description: 'Discover Wizard of Wor community features: profiles, chat, clans, leaderboards, and challenges.'
};

export default function FeaturesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Community Features</h1>
      <p className="text-zinc-300">
        Everything around the core game is designed to improve social play, fair competition, and player retention.
      </p>
      <FeatureGrid />
      <CTASection />
    </div>
  );
}
