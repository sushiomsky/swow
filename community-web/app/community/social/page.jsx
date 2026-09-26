import FriendsPanel from '../../../components/FriendsPanel';
import NotificationsPanel from '../../../components/NotificationsPanel';
import SocialSignInHint from '../../../components/SocialSignInHint';

export const metadata = {
  title: 'Social',
  description: 'Manage friends, requests, and social activity notifications.'
};

export default function SocialPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SocialSignInHint />
      <FriendsPanel />
      <NotificationsPanel />
    </div>
  );
}
