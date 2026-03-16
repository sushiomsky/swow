import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_COMMUNITY_SOCKET_URL || '';
export const communitySocket = io(SOCKET_URL, { autoConnect: false });
