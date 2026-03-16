export default function LeaderboardTable({ rows }) {
  return (
    <section className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th className="px-2 py-2 text-left">Rank</th>
            <th className="px-2 py-2 text-left">Player</th>
            <th className="px-2 py-2 text-left">Region</th>
            <th className="px-2 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-t border-zinc-800">
              <td className="px-2 py-2">#{row.rank}</td>
              <td className="px-2 py-2">{row.display_name || row.username}</td>
              <td className="px-2 py-2">{row.region || 'N/A'}</td>
              <td className="px-2 py-2 text-right">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
