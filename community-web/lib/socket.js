import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_COMMUNITY_SOCKET_URL || '';
export const communitySocket = io(SOCKET_URL, { autoConnect: false });

export function connectCommunitySocket(token) {
  if (typeof window === 'undefined') return false;
  if (!token) return false;
  communitySocket.auth = { token };
  if (!communitySocket.connected) communitySocket.connect();
  return true;
}

export function disconnectCommunitySocket() {
  if (communitySocket.connected) communitySocket.disconnect();
}
