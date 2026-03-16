'use client';

import { useCommunityStore } from '../store/useCommunityStore';

export default function NotificationsPanel() {
  const notifications = useCommunityStore((s) => s.notifications);
  return (
    <section className="card">
      <h3 className="mb-2 text-lg font-semibold">Notifications</h3>
      <ul className="space-y-2 text-sm">
        {notifications.map((n) => (
          <li key={n.notification_id || `${n.type}-${n.created_at}`} className="rounded border border-zinc-700 p-2">
            <p className="font-medium">{n.type}</p>
            <p className="text-zinc-300">{n.content}</p>
          </li>
        ))}
        {notifications.length === 0 && <li className="text-zinc-400">No notifications yet.</li>}
      </ul>
    </section>
  );
}
