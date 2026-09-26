const FEATURES = [
  { title: 'Saison-Ranglisten', text: 'Globale und regionale Bestenlisten mit Saison-Resets und Belohnungen.' },
  { title: 'Spielerprofile', text: 'XP, Level, Abzeichen, Spielergebnisse und Highlights im Blick.' },
  { title: 'Clans & Teamspiel', text: 'Clans gründen oder beitreten, chatten und gemeinsam aufsteigen.' },
  { title: 'Tägliche Herausforderungen', text: 'Wechselnde Ziele für Titel, Belohnungen und Fortschritt.' },
  { title: 'Live-Chat', text: 'Globaler, Spiel- und Clan-Chat mit Echtzeit-Mitteilungen.' },
  { title: 'Faire Moderation', text: 'Meldungen, Stummschalten und Sperren über Admin-Werkzeuge.' }
];

export default function FeatureGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="card">
          <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
          <p className="text-sm text-zinc-300">{feature.text}</p>
        </article>
      ))}
    </section>
  );
}
