import FriendsPanel from '../../../components/FriendsPanel';
import NotificationsPanel from '../../../components/NotificationsPanel';

export const metadata = {
  title: 'Social',
  description: 'Manage friends, requests, and social activity notifications.'
};

export default function SocialPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FriendsPanel />
      <NotificationsPanel />
    </div>
  );
}
