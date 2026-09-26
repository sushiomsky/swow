'use client';

import Link from 'next/link';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';

const STRINGS = {
  de: {
    title: 'Melde dich an für Sozial',
    body: 'Freunde, Anfragen und Mitteilungen brauchen ein Konto. Melde dich auf der Startseite an und komm dann hierher zurück.',
    cta: 'Zur Anmeldung →'
  },
  en: {
    title: 'Sign in for Social',
    body: 'Friends, requests and notifications need an account. Sign in on the homepage and come back here.',
    cta: 'To sign-in →'
  }
};

// M4 follow-up: explain logged-out empty state on /community/social with a
// sign-in CTA instead of bare "No friends yet" panels.
export default function SocialSignInHint() {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const { isAuthenticated, ready } = useCommunitySession();
  if (!ready || isAuthenticated) return null;
  return (
    <section className="card border-indigo-500/30 bg-indigo-500/5 md:col-span-2">
      <h2 className="text-lg font-semibold">{t.title}</h2>
      <p className="mt-1 text-sm text-zinc-300">
        {t.body}
      </p>
      <Link
        href="/"
        className="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        {t.cta}
      </Link>
    </section>
  );
}
