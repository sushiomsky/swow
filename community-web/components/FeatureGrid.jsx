'use client';

import { useLocale } from '../providers/LocaleProvider';

const FEATURES = {
  de: [
    { title: 'Saison-Ranglisten', text: 'Globale und regionale Bestenlisten mit Saison-Resets und Belohnungen.' },
    { title: 'Spielerprofile', text: 'XP, Level, Abzeichen, Spielergebnisse und Highlights im Blick.' },
    { title: 'Clans & Teamspiel', text: 'Clans gründen oder beitreten, chatten und gemeinsam aufsteigen.' },
    { title: 'Tägliche Herausforderungen', text: 'Wechselnde Ziele für Titel, Belohnungen und Fortschritt.' },
    { title: 'Live-Chat', text: 'Globaler, Spiel- und Clan-Chat mit Echtzeit-Mitteilungen.' },
    { title: 'Faire Moderation', text: 'Meldungen, Stummschalten und Sperren über Admin-Werkzeuge.' }
  ],
  en: [
    { title: 'Season rankings', text: 'Global and regional leaderboards with season resets and rewards.' },
    { title: 'Player profiles', text: 'XP, level, badges, match results and highlights at a glance.' },
    { title: 'Clans & team play', text: 'Found or join clans, chat and climb together.' },
    { title: 'Daily challenges', text: 'Rotating goals for titles, rewards and progress.' },
    { title: 'Live chat', text: 'Global, match and clan chat with realtime notifications.' },
    { title: 'Fair moderation', text: 'Reports, mutes and bans via admin tools.' }
  ]
};

export default function FeatureGrid() {
  const { locale } = useLocale();
  const items = FEATURES[locale] || FEATURES.de;
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((feature) => (
        <article key={feature.title} className="card">
          <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
          <p className="text-sm text-zinc-300">{feature.text}</p>
        </article>
      ))}
    </section>
  );
}
