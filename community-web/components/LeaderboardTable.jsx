'use client';

import { useLocale } from '../providers/LocaleProvider';

const TEXTS = {
  de: {
    emptyTitle: 'Noch keine Scores — sei der Erste!',
    emptySub: 'Spiele eine Runde und sichere dir Platz 1.',
    rank: 'Rang',
    player: 'Spieler',
    region: 'Region',
    score: 'Punkte'
  },
  en: {
    emptyTitle: 'No scores yet — be the first!',
    emptySub: 'Play a round and claim rank 1.',
    rank: 'Rank',
    player: 'Player',
    region: 'Region',
    score: 'Score'
  }
};

export default function LeaderboardTable({ rows }) {
  const { locale } = useLocale();
  const t = TEXTS[locale] || TEXTS.de;
  if (!rows || rows.length === 0) {
    return (
      <section className="card p-8 text-center">
        <p className="text-2xl">🏆</p>
        <p className="mt-2 text-base font-semibold">{t.emptyTitle}</p>
        <p className="mt-1 text-sm text-zinc-400">{t.emptySub}</p>
      </section>
    );
  }
  return (
    <section className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th className="px-2 py-2 text-left">{t.rank}</th>
            <th className="px-2 py-2 text-left">{t.player}</th>
            <th className="px-2 py-2 text-left">{t.region}</th>
            <th className="px-2 py-2 text-right">{t.score}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-t border-zinc-800">
              <td className="px-2 py-2">#{row.rank}</td>
              <td className="px-2 py-2">{row.display_name || row.username}</td>
              <td className="px-2 py-2">{row.region || '–'}</td>
              <td className="px-2 py-2 text-right">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
