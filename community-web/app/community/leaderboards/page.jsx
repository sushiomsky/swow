import LeaderboardTable from '../../../components/LeaderboardTable';
import { apiGet } from '../../../lib/api';

export default async function LeaderboardsPage() {
  const rows = await apiGet('/leaderboards?season=current').catch(() => []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboards</h1>
      <LeaderboardTable rows={rows} />
    </div>
  );
}
