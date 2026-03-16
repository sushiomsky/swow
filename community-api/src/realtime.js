let ioInstance = null;

export function setRealtimeIO(io) {
  ioInstance = io;
}

export function emitToAll(event, payload) {
  if (ioInstance) ioInstance.emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (ioInstance && userId) ioInstance.to(`user:${userId}`).emit(event, payload);
}

