import './globals.css';
import { CommunitySessionProvider } from '../providers/CommunitySessionProvider';
import { RealtimeProvider } from '../providers/RealtimeProvider';
import { LocaleProvider } from '../providers/LocaleProvider';
import SiteChrome from '../components/SiteChrome';
import SessionNotice from '../components/SessionNotice';
import FeedbackButton from '../components/FeedbackButton';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://wizardofwor.duckdns.org'),
  title: {
    default: 'Wizard of Wor Community',
    template: '%s | Wizard of Wor Community'
  },
  description: 'Play Wizard of Wor online and join a competitive community with leaderboards, clans, events, and live chat.',
  openGraph: {
    title: 'Wizard of Wor Community',
    description: 'Classic arcade action plus modern social, ranked, and event features.',
    type: 'website',
    url: '/community'
  },
  alternates: {
    canonical: '/community'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <LocaleProvider>
        <CommunitySessionProvider>
          <RealtimeProvider>
            <SiteChrome />
            <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-8">
              <SessionNotice />
              {children}
            </main>
            <FeedbackButton />
          </RealtimeProvider>
        </CommunitySessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
