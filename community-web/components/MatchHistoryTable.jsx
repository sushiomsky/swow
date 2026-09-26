'use client';

import { useLocale } from '../providers/LocaleProvider';

const T = {
  de: {
    title: 'Letzte Spiele',
    date: 'Datum',
    mode: 'Modus',
    score: 'Punkte',
    result: 'Ergebnis',
    empty: 'Noch keine Spiele.'
  },
  en: {
    title: 'Recent Matches',
    date: 'Date',
    mode: 'Mode',
    score: 'Score',
    result: 'Result',
    empty: 'No match history yet.'
  }
};

export default function MatchHistoryTable({ rows = [] }) {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <section className="card overflow-x-auto">
      <h3 className="mb-3 text-lg font-semibold">{t.title}</h3>
      <table className="min-w-full text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th className="px-2 py-2 text-left">{t.date}</th>
            <th className="px-2 py-2 text-left">{t.mode}</th>
            <th className="px-2 py-2 text-right">{t.score}</th>
            <th className="px-2 py-2 text-right">K/D</th>
            <th className="px-2 py-2 text-left">{t.result}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.match_id} className="border-t border-zinc-800">
              <td className="px-2 py-2">{new Date(m.created_at).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE')}</td>
              <td className="px-2 py-2">{m.mode}</td>
              <td className="px-2 py-2 text-right">{m.score}</td>
              <td className="px-2 py-2 text-right">{m.kills}/{m.deaths}</td>
              <td className="px-2 py-2 capitalize">{m.result}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-2 py-4 text-zinc-400" colSpan={5}>{t.empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
