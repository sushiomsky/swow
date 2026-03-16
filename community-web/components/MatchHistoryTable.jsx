export default function MatchHistoryTable({ rows = [] }) {
  return (
    <section className="card overflow-x-auto">
      <h3 className="mb-3 text-lg font-semibold">Recent Matches</h3>
      <table className="min-w-full text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th className="px-2 py-2 text-left">Date</th>
            <th className="px-2 py-2 text-left">Mode</th>
            <th className="px-2 py-2 text-right">Score</th>
            <th className="px-2 py-2 text-right">K/D</th>
            <th className="px-2 py-2 text-left">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.match_id} className="border-t border-zinc-800">
              <td className="px-2 py-2">{new Date(m.created_at).toLocaleString()}</td>
              <td className="px-2 py-2">{m.mode}</td>
              <td className="px-2 py-2 text-right">{m.score}</td>
              <td className="px-2 py-2 text-right">{m.kills}/{m.deaths}</td>
              <td className="px-2 py-2 capitalize">{m.result}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-2 py-4 text-zinc-400" colSpan={5}>No match history yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
