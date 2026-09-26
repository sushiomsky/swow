export const metadata = {
  title: 'Über uns',
  description: 'Über die Wizard-of-Wor-Community: Spiel, fairer Wettkampf und Moderation.'
};

export default function AboutPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Über die Community</h1>
      <section className="card space-y-3 text-sm text-zinc-300">
        <p>
          Die Wizard-of-Wor-Community ist die soziale und kompetitive Ebene rund um das
          Arcade-Spiel: Profile, Clans, Bestenlisten und Chat — das Spiel selbst bleibt unverändert.
        </p>
        <p>
          Uns geht es um fairen Wettkampf, transparente Moderation und Fortschritt
          über Saisons, Herausforderungen und Profile.
        </p>
      </section>
      <section className="card space-y-2 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">Was wir bieten</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Öffentliche Profile, Clan-Seiten und Ranglisten</li>
          <li>Echtzeit-Chat und Mitteilungen</li>
          <li>Moderation bei Meldungen und Missbrauch</li>
        </ul>
      </section>
    </div>
  );
}
