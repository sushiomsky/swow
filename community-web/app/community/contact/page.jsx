'use client';

import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Kontakt & Hilfe',
    intro: 'Bei Fragen zu Konto, Moderation oder Events:',
    response: 'Antwortziel: 24–72 Stunden je nach Anfragevolumen.'
  },
  en: {
    title: 'Contact & help',
    intro: 'For questions about accounts, moderation or events:',
    response: 'Response target: 24–72 hours depending on request volume.'
  }
};

export default function ContactPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <section className="card space-y-2 text-sm text-zinc-300">
        <p>{t.intro}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Support: support@wizardofwor.community</li>
          <li>Moderation: moderation@wizardofwor.community</li>
        </ul>
      </section>
      <section className="card text-sm text-zinc-300">
        <p>{t.response}</p>
      </section>
    </div>
  );
}
