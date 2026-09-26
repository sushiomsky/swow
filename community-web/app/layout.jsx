import './globals.css';
import Link from 'next/link';
import { CommunitySessionProvider } from '../providers/CommunitySessionProvider';
import { RealtimeProvider } from '../providers/RealtimeProvider';
import { LocaleProvider } from '../providers/LocaleProvider';
import LocaleSwitcher from '../components/LocaleSwitcher';
import SessionNotice from '../components/SessionNotice';
import FeedbackButton from '../components/FeedbackButton';
import { GAME_URLS } from '../lib/gameLinks';

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
            <header className="site-header">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
                <Link href="/" className="text-lg font-bold tracking-wide">Wizard of Wor Platform</Link>
                <nav className="flex flex-wrap items-center gap-4 text-sm text-zinc-300" aria-label="Hauptnavigation">
                  <Link href="/">Start</Link>
                  <Link href="/community/leaderboards">Bestenlisten</Link>
                  <Link href="/community/clans">Clans</Link>
                  <Link href="/community/forum">Forum</Link>
                  <Link href="/community/social">Sozial</Link>
                  <a href={GAME_URLS.spectate} className="text-zinc-300 hover:text-white">Zuschauen</a>
                  <a className="rounded bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500" href={GAME_URLS.multiplayer}>Spielen</a>
                  <LocaleSwitcher />
                </nav>
              </div>
            </header>
            <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-8">
              <SessionNotice />
              {children}
            </main>
            <footer className="site-footer">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-zinc-400">
                <p>Wizard of Wor Community Platform</p>
                <div className="flex gap-4">
                  <Link href="/community/about">Über uns</Link>
                  <Link href="/community/faq">Hilfe</Link>
                  <Link href="/community/privacy-policy">Datenschutz</Link>
                  <Link href="/community/terms-of-service">Bedingungen</Link>
                  <Link href="/community/contact">Kontakt</Link>
                </div>
              </div>
            </footer>
            <FeedbackButton />
          </RealtimeProvider>
        </CommunitySessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
