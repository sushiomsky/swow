'use client';

import { create } from 'zustand';

export const useCommunityStore = create((set) => ({
  notifications: [],
  setNotifications: (items) => set({ notifications: items }),
  addNotification: (item) => set((s) => ({ notifications: [item, ...s.notifications] }))
}));
