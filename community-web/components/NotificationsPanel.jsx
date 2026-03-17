'use client';

import { useCallback, useEffect } from 'react';
import { useCommunityStore } from '../store/useCommunityStore';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useRealtime, useRealtimeEvent } from '../providers/RealtimeProvider';

export default function NotificationsPanel() {
  const notifications = useCommunityStore((s) => s.notifications);
  const setNotifications = useCommunityStore((s) => s.setNotifications);
  const addNotification = useCommunityStore((s) => s.addNotification);
  const { token, api } = useCommunitySession();
  const { subscribeNotifications, unsubscribeNotifications } = useRealtime();
  const onNotification = useCallback((notification) => {
    addNotification({ ...notification, created_at: new Date().toISOString() });
  }, [addNotification]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }

    const load = async () => {
      try {
        const items = await api.listNotifications();
        setNotifications(items || []);
      } catch (_) {}
    };
    load();
  }, [setNotifications, token, api]);

  useEffect(() => {
    if (!token) return;
    subscribeNotifications();
    return () => {
      unsubscribeNotifications();
    };
  }, [token, subscribeNotifications, unsubscribeNotifications]);

  useRealtimeEvent('notification', onNotification);

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
