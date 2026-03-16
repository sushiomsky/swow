import ChatRoom from '../../../../components/ChatRoom';
import { apiGet } from '../../../../lib/api';

export default async function ClanPage({ params }) {
  const clan = await apiGet(`/clans/${params.id}`).catch(() => ({
    clan_id: params.id,
    name: 'Unknown Clan',
    members: []
  }));

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-2xl font-bold">{clan.name}</h1>
        <p className="text-zinc-400">{clan.members.length} member(s)</p>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Members</h2>
        <ul className="space-y-1 text-sm">
          {clan.members.map((m) => (
            <li key={m.user_id}>{m.display_name || m.username}</li>
          ))}
          {clan.members.length === 0 && <li className="text-zinc-400">No members yet.</li>}
        </ul>
      </section>
      <ChatRoom roomType="clan" roomId={params.id} />
    </div>
  );
}
