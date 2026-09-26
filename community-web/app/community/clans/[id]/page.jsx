'use client';

import { useEffect, useState } from 'react';
import ChatRoom from '../../../../components/ChatRoom';
import ClanActions from '../../../../components/ClanActions';
import { apiGet } from '../../../../lib/api';
import { useLocale } from '../../../../providers/LocaleProvider';

const T = {
  de: {
    members: (n) => `${n} Mitglied(er)`,
    membersTitle: 'Mitglieder',
    empty: 'Noch keine Mitglieder.',
    fallbackName: 'Unbekannter Clan',
    loading: 'Wird geladen…'
  },
  en: {
    members: (n) => `${n} member(s)`,
    membersTitle: 'Members',
    empty: 'No members yet.',
    fallbackName: 'Unknown Clan',
    loading: 'Loading…'
  }
};

export default function ClanPage({ params }) {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  const [clan, setClan] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiGet(`/clans/${params.id}`)
      .then((data) => { if (!cancelled) setClan(data); })
      .catch(() => {
        if (!cancelled) setClan({ clan_id: params.id, name: t.fallbackName, members: [] });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!clan) {
    return (
      <div className="space-y-4">
        <section className="card"><p className="text-sm text-zinc-400">{t.loading}</p></section>
      </div>
    );
  }

  const members = Array.isArray(clan.members) ? clan.members : [];

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-2xl font-bold">{clan.name}</h1>
        <p className="text-zinc-400">{t.members(members.length)}</p>
        <div className="mt-3">
          <ClanActions clanId={params.id} />
        </div>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">{t.membersTitle}</h2>
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.user_id}>{m.display_name || m.username}</li>
          ))}
          {members.length === 0 && <li className="text-zinc-400">{t.empty}</li>}
        </ul>
      </section>
      <ChatRoom roomType="clan" roomId={params.id} />
    </div>
  );
}
