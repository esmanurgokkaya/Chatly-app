"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocketConnection, socketEvents, MessageStatus } from '@/lib/socket';

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: string[];
  typingUsers: Map<string, boolean>;
  sendTypingStatus: (recipientId: string, isTyping: boolean) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  onlineUsers: [],
  typingUsers: new Map(),
  sendTypingStatus: () => {},
  updateMessageStatus: () => {},
  isConnected: false,
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const sendTypingStatus = useCallback((recipientId: string, isTyping: boolean) => {
    if (socket) {
      socket.emit(isTyping ? socketEvents.USER_TYPING : socketEvents.USER_STOP_TYPING, { 
        recipientId, 
        isTyping 
      });
    }
  }, [socket]);

  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    if (socket) {
      if (status === 'delivered') {
        socket.emit(socketEvents.MESSAGE_DELIVERED, { messageId });
      } else if (status === 'read') {
        socket.emit(socketEvents.MESSAGE_READ, { messageId });
      }
    }
  }, [socket]);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) return;

    try {
      const userData = JSON.parse(user);
      const userId = userData.id || userData._id;
      if (!userId) return;

      const newSocket = createSocketConnection(
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        String(userId)
      );

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      newSocket.on('onlineUsers', (users: string[]) => {
        console.log('Received online users:', users);
        setOnlineUsers(users);
      });

      newSocket.on('userTyping', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          if (isTyping) {
            newMap.set(userId, true);
          } else {
            newMap.delete(userId);
          }
          return newMap;
        });
      });

      newSocket.on('messageStatus', ({ messageId, status }: { messageId: string; status: MessageStatus }) => {
        const event = new CustomEvent('messageStatus', { detail: { messageId, status } });
        window.dispatchEvent(event);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
        setTypingUsers(new Map());
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } catch (err) {
      console.error('Error initializing socket:', err);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      onlineUsers, 
      typingUsers, 
      sendTypingStatus, 
      updateMessageStatus,
      isConnected 
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);