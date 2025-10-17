import { io, Socket } from 'socket.io-client';

export const createSocketConnection = (url: string, userId: string): Socket => {
  const socket = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    auth: {
      userId
    }
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('join', { userId });
    socket.emit('userOnline', { userId });
  });

  socket.on('connect_error', (error: Error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
};

export const socketEvents = {
  SEND_MESSAGE: 'sendMessage',
  NEW_MESSAGE: 'newMessage',
  USER_ONLINE: 'userOnline',
  USER_OFFLINE: 'userOffline',
  USER_TYPING: 'typing',
  USER_STOP_TYPING: 'stopTyping',
  MESSAGE_DELIVERED: 'messageDelivered',
  MESSAGE_READ: 'messageRead',
  JOIN_ROOM: 'join',
  LEAVE_ROOM: 'leave',
};

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface SocketMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  text?: string;
  image?: string;
  createdAt?: string;
  status?: MessageStatus;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
}