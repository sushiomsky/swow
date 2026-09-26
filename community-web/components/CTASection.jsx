import { GAME_URLS } from '../lib/gameLinks';

export default function CTASection() {
  return (
    <section className="card flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h2 className="text-2xl font-bold">Bereit zum Spielen?</h2>
        <p className="mt-1 text-sm text-zinc-300">
          Steig ein und klettere mit deinem Clan die Rangliste hoch.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={GAME_URLS.multiplayer} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Jetzt spielen</a>
        <a href={GAME_URLS.classic} className="rounded border border-zinc-600 px-4 py-2 text-sm font-semibold">Klassik spielen</a>
      </div>
    </section>
  );
}
