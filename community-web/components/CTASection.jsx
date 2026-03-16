export default function CTASection() {
  return (
    <section className="card flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h2 className="text-2xl font-bold">Ready to play?</h2>
        <p className="mt-1 text-sm text-zinc-300">
          Jump into Wizard of Wor and climb the competitive ladder with your clan.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href="/multiplayer.html" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold">Play Multiplayer</a>
        <a href="/index.html" className="rounded border border-zinc-600 px-4 py-2 text-sm font-semibold">Play Classic</a>
      </div>
    </section>
  );
}
