import ProfileCard from '../../../../components/ProfileCard';
import NotificationsPanel from '../../../../components/NotificationsPanel';
import { apiGet } from '../../../../lib/api';

export default async function ProfilePage({ params }) {
  const profile = await apiGet(`/users/profile/${params.username}`).catch(() => ({
    username: params.username,
    display_name: 'Unknown',
    xp: 0,
    level: 1
  }));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2">
        <ProfileCard profile={profile} />
      </div>
      <NotificationsPanel />
    </div>
  );
}
