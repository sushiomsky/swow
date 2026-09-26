'use client';

import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Häufige Fragen',
    items: [
      {
        q: 'Verändert die Community das Spiel?',
        a: 'Nein. Bewegung, Kampf, Punkte und Gegner-Verhalten bleiben unverändert.'
      },
      {
        q: 'Wie werden Ränge berechnet?',
        a: 'Ranglisten werden pro Saison aus gespeicherten Punkten und Spielergebnissen neu berechnet.'
      },
      {
        q: 'Kann ich ohne Clan spielen?',
        a: 'Ja. Clans sind optional — du kannst trotzdem in globalen und regionalen Bestenlisten antreten.'
      },
      {
        q: 'Wie melde ich störendes Chat-Verhalten?',
        a: 'Nutze die Melden-Funktion im Chat; Meldungen werden von Admins geprüft.'
      },
      {
        q: 'Wo finde ich Datenschutz und Bedingungen?',
        a: 'Im Footer: Datenschutz, Bedingungen und Kontakt.'
      }
    ]
  },
  en: {
    title: 'Frequently asked questions',
    items: [
      {
        q: 'Does the community change the game?',
        a: 'No. Movement, combat, scoring and enemy behavior stay unchanged.'
      },
      {
        q: 'How are ranks calculated?',
        a: 'Leaderboards are recalculated per season from stored scores and match results.'
      },
      {
        q: 'Can I play without a clan?',
        a: 'Yes. Clans are optional — you can still compete on global and regional leaderboards.'
      },
      {
        q: 'How do I report disruptive chat behavior?',
        a: 'Use the report function in chat; reports are reviewed by admins.'
      },
      {
        q: 'Where do I find privacy and terms?',
        a: 'In the footer: privacy, terms and contact.'
      }
    ]
  }
};

export default function FAQPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <div className="space-y-3">
        {t.items.map((item) => (
          <article key={item.q} className="card">
            <h2 className="text-lg font-semibold">{item.q}</h2>
            <p className="mt-2 text-sm text-zinc-300">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
