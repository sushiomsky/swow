import { apiGet } from '../../lib/api';

export default async function AdminPage() {
  const analytics = await apiGet('/admin/analytics').catch(() => ({ dau: 0, wau: 0, mau: 0 }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="card"><p className="text-zinc-400">DAU</p><p className="text-3xl font-semibold">{analytics.dau}</p></div>
        <div className="card"><p className="text-zinc-400">WAU</p><p className="text-3xl font-semibold">{analytics.wau}</p></div>
        <div className="card"><p className="text-zinc-400">MAU</p><p className="text-3xl font-semibold">{analytics.mau}</p></div>
      </section>
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Moderation Tools</h2>
        <p className="text-sm text-zinc-300">Search, mute, ban, and report triage APIs are available under <code>/api/community/admin</code>.</p>
      </section>
    </div>
  );
}
