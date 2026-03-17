'use client';

import { useEffect } from 'react';
import { useCommunityStore } from '../store/useCommunityStore';
import { apiSend } from '../lib/api';
import { communitySocket, connectCommunitySocket } from '../lib/socket';

export default function NotificationsPanel() {
  const notifications = useCommunityStore((s) => s.notifications);
  const setNotifications = useCommunityStore((s) => s.setNotifications);
  const addNotification = useCommunityStore((s) => s.addNotification);

  useEffect(() => {
    const token = localStorage.getItem('communityToken');
    if (!token) return;

    const load = async () => {
      try {
        const items = await apiSend('/notifications', 'GET', null, token);
        setNotifications(items || []);
      } catch (_) {}
    };
    load();

    if (!connectCommunitySocket()) return;
    communitySocket.emit('subscribe_notifications');
    const onNotification = (n) => addNotification({ ...n, created_at: new Date().toISOString() });
    communitySocket.on('notification', onNotification);
    return () => communitySocket.off('notification', onNotification);
  }, [setNotifications, addNotification]);

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
