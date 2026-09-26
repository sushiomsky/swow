export const metadata = {
  title: 'Kontakt',
  description: 'Kontakt zum Wizard-of-Wor-Community-Support.'
};

export default function ContactPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Kontakt & Hilfe</h1>
      <section className="card space-y-2 text-sm text-zinc-300">
        <p>Bei Fragen zu Konto, Moderation oder Events:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Support: support@wizardofwor.community</li>
          <li>Moderation: moderation@wizardofwor.community</li>
        </ul>
      </section>
      <section className="card text-sm text-zinc-300">
        <p>Antwortziel: 24–72 Stunden je nach Anfragevolumen.</p>
      </section>
    </div>
  );
}
