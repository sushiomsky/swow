'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { useRealtime, useRealtimeEvent } from '../providers/RealtimeProvider';
import { toUserErrorMessage } from '../lib/errorUtils';
import ErrorText from './ErrorText';

const STRINGS = {
  de: {
    chat: 'Chat',
    room: 'Raum',
    signInToChat: 'Melde dich an, um am Live-Chat teilzunehmen.',
    filterPlaceholder: 'Nachrichten nach Absender oder Text filtern…',
    loadingMessages: 'Lade aktuelle Nachrichten…',
    noMessages: 'Noch keine Nachrichten.',
    report: 'melden',
    messagePlaceholder: 'Nachricht schreiben…',
    send: 'Senden',
    historyFailed: 'Chatverlauf konnte nicht geladen werden.',
    reportFailed: 'Melden fehlgeschlagen.'
  },
  en: {
    chat: 'Chat',
    room: 'room',
    signInToChat: 'Sign in to join the live chat.',
    filterPlaceholder: 'Filter messages by sender or text…',
    loadingMessages: 'Loading recent messages…',
    noMessages: 'No messages yet.',
    report: 'report',
    messagePlaceholder: 'Write a message…',
    send: 'Send',
    historyFailed: 'Unable to load chat history.',
    reportFailed: 'Unable to report message.'
  }
};

function buildRoomKey(roomType, roomId) {
  return `${roomType}:${roomId}`;
}

function normalizeRoomOptions(roomType, roomId, roomOptions) {
  if (Array.isArray(roomOptions) && roomOptions.length > 0) {
    return roomOptions
      .filter((room) => room?.roomType && room?.roomId)
      .map((room) => ({
        roomType: room.roomType,
        roomId: room.roomId,
        key: buildRoomKey(room.roomType, room.roomId),
        label: room.label || `${room.roomType}:${room.roomId}`
      }));
  }
  return [{
    roomType,
    roomId,
    key: buildRoomKey(roomType, roomId),
    label: `${roomType}:${roomId}`
  }];
}

function appendUniqueMessage(messages, incoming) {
  if (!incoming) return messages;
  if (incoming.message_id && messages.some((message) => message.message_id === incoming.message_id)) {
    return messages;
  }
  return [...messages, incoming];
}

export default function ChatRoom({ roomType, roomId, roomOptions = null }) {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const rooms = useMemo(
    () => normalizeRoomOptions(roomType, roomId, roomOptions),
    [roomType, roomId, roomOptions]
  );
  const [activeRoomKey, setActiveRoomKey] = useState(rooms[0]?.key || '');
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [historyByRoom, setHistoryByRoom] = useState({});
  const [unreadByRoom, setUnreadByRoom] = useState({});
  const [content, setContent] = useState('');
  const [filterText, setFilterText] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, api } = useCommunitySession();
  const { connected, connectionError, emit, joinRoom, leaveRoom } = useRealtime();
  const historyRef = useRef(historyByRoom);
  const activeRoomKeyRef = useRef(activeRoomKey);

  useEffect(() => {
    historyRef.current = historyByRoom;
  }, [historyByRoom]);

  useEffect(() => {
    activeRoomKeyRef.current = activeRoomKey;
  }, [activeRoomKey]);

  useEffect(() => {
    setActiveRoomKey((current) => {
      if (rooms.some((room) => room.key === current)) return current;
      return rooms[0]?.key || '';
    });
  }, [rooms]);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.key === activeRoomKey) || rooms[0] || null,
    [rooms, activeRoomKey]
  );
  const roomKeySet = useMemo(() => new Set(rooms.map((room) => room.key)), [rooms]);

  const loadRoomHistory = useCallback(async (room) => {
    if (!room || !isAuthenticated) return;
    const historyState = historyRef.current[room.key];
    if (historyState?.loaded || historyState?.loading) return;
    setHistoryByRoom((current) => ({
      ...current,
      [room.key]: { loading: true, loaded: false, error: '' }
    }));
    try {
      const history = await api.listChatMessages(room.roomType, room.roomId);
      setMessagesByRoom((current) => ({
        ...current,
        [room.key]: Array.isArray(history) ? history : []
      }));
      setHistoryByRoom((current) => ({
        ...current,
        [room.key]: { loading: false, loaded: true, error: '' }
      }));
    } catch (historyError) {
      setHistoryByRoom((current) => ({
        ...current,
        [room.key]: {
          loading: false,
          loaded: false,
          error: toUserErrorMessage(historyError, t.historyFailed)
        }
      }));
    }
  }, [api, isAuthenticated, t.historyFailed]);

  const onMessage = useCallback((msg) => {
    const key = buildRoomKey(msg?.room_type, msg?.room_id);
    if (!roomKeySet.has(key)) return;
    setMessagesByRoom((current) => ({
      ...current,
      [key]: appendUniqueMessage(current[key] || [], msg)
    }));
    if (key !== activeRoomKeyRef.current) {
      setUnreadByRoom((current) => ({
        ...current,
        [key]: (current[key] || 0) + 1
      }));
    }
  }, [roomKeySet]);
  useRealtimeEvent('chat_message', onMessage);

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthRequired(true);
      setMessagesByRoom({});
      setHistoryByRoom({});
      setUnreadByRoom({});
      return;
    }
    setAuthRequired(!connected);
  }, [isAuthenticated, connected]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    for (const room of rooms) {
      joinRoom(room.roomType, room.roomId);
    }
    return () => {
      for (const room of rooms) {
        leaveRoom(room.roomType, room.roomId);
      }
    };
  }, [isAuthenticated, joinRoom, leaveRoom, rooms]);

  useEffect(() => {
    if (!activeRoom || !isAuthenticated) return;
    setUnreadByRoom((current) => ({ ...current, [activeRoom.key]: 0 }));
    loadRoomHistory(activeRoom);
  }, [activeRoom, isAuthenticated, loadRoomHistory]);

  const switchRoom = (roomKey) => {
    setActiveRoomKey(roomKey);
    setUnreadByRoom((current) => ({ ...current, [roomKey]: 0 }));
  };

  const send = () => {
    if (!content.trim()) return;
    if (!isAuthenticated || !connected || !activeRoom) {
      setAuthRequired(true);
      return;
    }
    setError('');
    const sent = emit('chat_message', {
      roomType: activeRoom.roomType,
      roomId: activeRoom.roomId,
      content
    });
    if (!sent) {
      setAuthRequired(true);
      return;
    }
    setContent('');
  };

  const reportMessage = async (messageId) => {
    try {
      await api.reportChatMessage(messageId, 'abuse');
      setError('');
    } catch (reportError) {
      setError(toUserErrorMessage(reportError, t.reportFailed));
    }
  };

  const activeMessages = activeRoom ? (messagesByRoom[activeRoom.key] || []) : [];
  const normalizedFilterText = filterText.trim().toLowerCase();
  const filteredMessages = useMemo(() => {
    if (!normalizedFilterText) return activeMessages;
    return activeMessages.filter((message) => {
      const contentText = String(message?.content || '').toLowerCase();
      const senderText = String(message?.sender_id || '').toLowerCase();
      return contentText.includes(normalizedFilterText) || senderText.includes(normalizedFilterText);
    });
  }, [activeMessages, normalizedFilterText]);

  const activeHistoryState = activeRoom ? historyByRoom[activeRoom.key] : null;
  const activeHistoryLoading = Boolean(activeHistoryState?.loading);
  const activeHistoryError = activeHistoryState?.error || '';

  return (
    <section className="card">
      <h3 className="mb-2 text-lg font-semibold">{t.chat} • {activeRoom?.label || t.room}</h3>
      {rooms.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {rooms.map((room) => {
            const unread = unreadByRoom[room.key] || 0;
            const isActive = room.key === activeRoom?.key;
            return (
              <button
                key={room.key}
                onClick={() => switchRoom(room.key)}
                className={`rounded border px-3 py-1 text-xs ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-100'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {room.label}
                {unread > 0 && (
                  <span className="ml-2 rounded bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {authRequired && <p className="mb-2 text-xs text-amber-300">{t.signInToChat}</p>}
      {!authRequired && connectionError && <p className="mb-2 text-xs text-amber-300">{connectionError}</p>}
      {!authRequired && (
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className="mb-3 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder={t.filterPlaceholder}
        />
      )}
      <ErrorText message={activeHistoryError || error} className="mb-2" />
      <div className="mb-3 h-56 overflow-auto rounded border border-zinc-800 p-2 text-sm">
        {activeHistoryLoading && <p className="text-zinc-400">{t.loadingMessages}</p>}
        {!activeHistoryLoading && filteredMessages.length === 0 && (
          <p className="text-zinc-500">{t.noMessages}</p>
        )}
        {!activeHistoryLoading && filteredMessages.map((message, index) => (
          <p key={message.message_id || `${message.created_at || 'live'}-${index}`} className="mb-1">
            <span className="text-zinc-500">{message.sender_id || 'system'}: </span>
            {message.content}
            {message.message_id && (
              <button
                onClick={() => reportMessage(message.message_id)}
                className="ml-2 text-xs text-rose-300 underline"
              >
                {t.report}
              </button>
            )}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder={t.messagePlaceholder}
          disabled={authRequired}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60" disabled={authRequired}>{t.send}</button>
      </div>
    </section>
  );
}
