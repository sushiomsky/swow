const FAQ = [
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
];

export const metadata = {
  title: 'Hilfe',
  description: 'Häufige Fragen zu Community-Konto, Ranglisten und Moderation.'
};

export default function FAQPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Häufige Fragen</h1>
      <div className="space-y-3">
        {FAQ.map((item) => (
          <article key={item.q} className="card">
            <h2 className="text-lg font-semibold">{item.q}</h2>
            <p className="mt-2 text-sm text-zinc-300">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
