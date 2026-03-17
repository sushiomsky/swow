'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { connectCommunitySocket, communitySocket, disconnectCommunitySocket } from '../lib/socket';
import { useCommunitySession } from './CommunitySessionProvider';

const RealtimeContext = createContext(null);

function roomKey(roomType, roomId) {
  return `${roomType}:${roomId}`;
}

function parseRoomKey(key) {
  const [roomType, ...rest] = key.split(':');
  return { roomType, roomId: rest.join(':') };
}

export function RealtimeProvider({ children }) {
  const { token } = useCommunitySession();
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const roomSubscriptionsRef = useRef(new Set());
  const notificationsSubscribedRef = useRef(false);

  const replaySubscriptions = useCallback(() => {
    for (const key of roomSubscriptionsRef.current) {
      const { roomType, roomId } = parseRoomKey(key);
      communitySocket.emit('join_room', { roomType, roomId });
    }
    if (notificationsSubscribedRef.current) {
      communitySocket.emit('subscribe_notifications');
    }
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setConnectionError('');
      replaySubscriptions();
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = (error) => {
      setConnected(false);
      setConnectionError(error?.message || 'Realtime connection failed.');
    };

    communitySocket.on('connect', onConnect);
    communitySocket.on('disconnect', onDisconnect);
    communitySocket.on('connect_error', onConnectError);

    return () => {
      communitySocket.off('connect', onConnect);
      communitySocket.off('disconnect', onDisconnect);
      communitySocket.off('connect_error', onConnectError);
    };
  }, [replaySubscriptions]);

  useEffect(() => {
    if (!token) {
      roomSubscriptionsRef.current.clear();
      notificationsSubscribedRef.current = false;
      setConnected(false);
      setConnectionError('');
      disconnectCommunitySocket();
      return;
    }

    const didConnect = connectCommunitySocket(token);
    if (!didConnect) {
      setConnected(false);
      setConnectionError('Sign in to enable realtime features.');
    }
  }, [token]);

  const joinRoom = useCallback((roomType, roomId) => {
    if (!roomType || !roomId) return;
    const key = roomKey(roomType, roomId);
    roomSubscriptionsRef.current.add(key);
    if (communitySocket.connected) {
      communitySocket.emit('join_room', { roomType, roomId });
    }
  }, []);

  const leaveRoom = useCallback((roomType, roomId) => {
    if (!roomType || !roomId) return;
    const key = roomKey(roomType, roomId);
    roomSubscriptionsRef.current.delete(key);
    if (communitySocket.connected) {
      communitySocket.emit('leave_room', { roomType, roomId });
    }
  }, []);

  const subscribeNotifications = useCallback(() => {
    notificationsSubscribedRef.current = true;
    if (communitySocket.connected) {
      communitySocket.emit('subscribe_notifications');
    }
  }, []);

  const unsubscribeNotifications = useCallback(() => {
    notificationsSubscribedRef.current = false;
  }, []);

  const onEvent = useCallback((eventName, handler) => {
    communitySocket.on(eventName, handler);
    return () => {
      communitySocket.off(eventName, handler);
    };
  }, []);

  const emit = useCallback((eventName, payload) => {
    if (!communitySocket.connected) return false;
    communitySocket.emit(eventName, payload);
    return true;
  }, []);

  const value = useMemo(() => ({
    connected,
    connectionError,
    joinRoom,
    leaveRoom,
    subscribeNotifications,
    unsubscribeNotifications,
    onEvent,
    emit
  }), [
    connected,
    connectionError,
    joinRoom,
    leaveRoom,
    subscribeNotifications,
    unsubscribeNotifications,
    onEvent,
    emit
  ]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}

export function useRealtimeEvent(eventName, handler) {
  const { onEvent } = useRealtime();

  useEffect(() => {
    if (!eventName || typeof handler !== 'function') return undefined;
    return onEvent(eventName, handler);
  }, [eventName, handler, onEvent]);
}

export function useRealtimeRoom(roomType, roomId, enabled = true) {
  const { joinRoom, leaveRoom } = useRealtime();

  useEffect(() => {
    if (!enabled || !roomType || !roomId) return undefined;
    joinRoom(roomType, roomId);
    return () => {
      leaveRoom(roomType, roomId);
    };
  }, [enabled, roomType, roomId, joinRoom, leaveRoom]);
}
