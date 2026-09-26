'use client';

import FriendsPanel from '../../../components/FriendsPanel';
import NotificationsPanel from '../../../components/NotificationsPanel';
import SocialSignInHint from '../../../components/SocialSignInHint';
import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: { title: 'Sozial' },
  en: { title: 'Social' }
};

export default function SocialPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <SocialSignInHint />
        <FriendsPanel />
        <NotificationsPanel />
      </div>
    </div>
  );
}
