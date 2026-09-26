'use client';

import Link from 'next/link';
import { GAME_URLS } from '../lib/gameLinks';
import { useLocale } from '../providers/LocaleProvider';
import LocaleSwitcher from './LocaleSwitcher';

const T = {
  de: {
    navLabel: 'Hauptnavigation',
    home: 'Start',
    boards: 'Bestenlisten',
    clans: 'Clans',
    forum: 'Forum',
    social: 'Sozial',
    spectate: 'Zuschauen',
    play: 'Spielen',
    brand: 'Wizard of Wor Community Platform',
    about: 'Über uns',
    help: 'Hilfe',
    privacy: 'Datenschutz',
    terms: 'Bedingungen',
    contact: 'Kontakt'
  },
  en: {
    navLabel: 'Main navigation',
    home: 'Home',
    boards: 'Leaderboards',
    clans: 'Clans',
    forum: 'Forum',
    social: 'Social',
    spectate: 'Spectate',
    play: 'Play',
    brand: 'Wizard of Wor Community Platform',
    about: 'About',
    help: 'Help',
    privacy: 'Privacy',
    terms: 'Terms',
    contact: 'Contact'
  }
};

export default function SiteChrome() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <>
      <header className="site-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-wide">Wizard of Wor Platform</Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-zinc-300" aria-label={t.navLabel}>
            <Link href="/">{t.home}</Link>
            <Link href="/community/leaderboards">{t.boards}</Link>
            <Link href="/community/clans">{t.clans}</Link>
            <Link href="/community/forum">{t.forum}</Link>
            <Link href="/community/social">{t.social}</Link>
            <a href={GAME_URLS.spectate} className="text-zinc-300 hover:text-white">{t.spectate}</a>
            <a className="rounded bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500" href={GAME_URLS.multiplayer}>{t.play}</a>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>
      <footer className="site-footer">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-zinc-400">
          <p>{t.brand}</p>
          <div className="flex gap-4">
            <Link href="/community/about">{t.about}</Link>
            <Link href="/community/faq">{t.help}</Link>
            <Link href="/community/privacy-policy">{t.privacy}</Link>
            <Link href="/community/terms-of-service">{t.terms}</Link>
            <Link href="/community/contact">{t.contact}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
