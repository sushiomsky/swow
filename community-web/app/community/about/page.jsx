'use client';

import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Über die Community',
    intro1: 'Die Wizard-of-Wor-Community ist die soziale und kompetitive Ebene rund um das Arcade-Spiel: Profile, Clans, Bestenlisten und Chat — das Spiel selbst bleibt unverändert.',
    intro2: 'Uns geht es um fairen Wettkampf, transparente Moderation und Fortschritt über Saisons, Herausforderungen und Profile.',
    offersTitle: 'Was wir bieten',
    offers: [
      'Öffentliche Profile, Clan-Seiten und Ranglisten',
      'Echtzeit-Chat und Mitteilungen',
      'Moderation bei Meldungen und Missbrauch'
    ]
  },
  en: {
    title: 'About the community',
    intro1: 'The Wizard of Wor community is the social and competitive layer around the arcade game: profiles, clans, leaderboards and chat — the game itself stays unchanged.',
    intro2: 'We stand for fair competition, transparent moderation and progress across seasons, challenges and profiles.',
    offersTitle: 'What we offer',
    offers: [
      'Public profiles, clan pages and rankings',
      'Real-time chat and notifications',
      'Moderation for reports and abuse'
    ]
  }
};

export default function AboutPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <section className="card space-y-3 text-sm text-zinc-300">
        <p>{t.intro1}</p>
        <p>{t.intro2}</p>
      </section>
      <section className="card space-y-2 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">{t.offersTitle}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {t.offers.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
