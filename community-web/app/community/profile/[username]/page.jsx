import ProfileCard from '../../../../components/ProfileCard';
import NotificationsPanel from '../../../../components/NotificationsPanel';
import ProfileEditor from '../../../../components/ProfileEditor';
import AchievementList from '../../../../components/AchievementList';
import MatchHistoryTable from '../../../../components/MatchHistoryTable';
import { apiGet } from '../../../../lib/api';

export default async function ProfilePage({ params }) {
  const profile = await apiGet(`/users/profile/${params.username}`).catch(() => ({
    username: params.username,
    display_name: 'Unknown',
    xp: 0,
    level: 1
  }));
  const matches = profile.user_id
    ? await apiGet(`/users/matches/${profile.user_id}`).catch(() => [])
    : [];
  const badges = profile.user_id
    ? await apiGet(`/users/badges/${profile.user_id}`).catch(() => [])
    : [];

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="space-y-4 md:col-span-8">
        <ProfileCard profile={profile} />
        <AchievementList achievements={profile.achievements || []} badges={badges} />
        <MatchHistoryTable rows={matches} />
      </div>
      <div className="space-y-4 md:col-span-4">
        <ProfileEditor profile={profile} />
        <NotificationsPanel />
      </div>
    </div>
  );
}
