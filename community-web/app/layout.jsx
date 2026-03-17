import './globals.css';
import Link from 'next/link';
import { CommunitySessionProvider } from '../providers/CommunitySessionProvider';
import SessionNotice from '../components/SessionNotice';

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
    <html lang="en">
      <body>
        <CommunitySessionProvider>
          <header className="site-header">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
              <Link href="/" className="text-lg font-bold tracking-wide">Wizard of Wor Platform</Link>
              <nav className="flex flex-wrap items-center gap-4 text-sm text-zinc-300">
                <Link href="/">Home</Link>
                <Link href="/community/features">Features</Link>
                <Link href="/community/leaderboards">Leaderboards</Link>
                <Link href="/community/challenges">Challenges</Link>
                <Link href="/community/forum">Forum</Link>
                <Link href="/community/social">Social</Link>
                <Link href="/community/faq">FAQ</Link>
                <Link href="/community/contact">Contact</Link>
                <a className="rounded border border-zinc-600 px-3 py-2 text-white" href="/index.html">Play Classic</a>
                <a className="rounded bg-indigo-600 px-3 py-2 text-white" href="/multiplayer.html">Play Multiplayer</a>
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
                <Link href="/community/about">About</Link>
                <Link href="/community/privacy-policy">Privacy</Link>
                <Link href="/community/terms-of-service">Terms</Link>
                <Link href="/community/contact">Support</Link>
                <Link href="/community/forum">Forum</Link>
              </div>
            </div>
          </footer>
        </CommunitySessionProvider>
      </body>
    </html>
  );
}
