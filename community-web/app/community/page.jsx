import CommunityLandingClient from './CommunityClient';

export const metadata = {
  title: 'Community',
  description: 'Community-Hub für Wizard of Wor: Ranglisten, Clans, Forum und Hilfe.',
  alternates: { canonical: '/community' }
};

export default function CommunityLandingPage() {
  return <CommunityLandingClient />;
}
