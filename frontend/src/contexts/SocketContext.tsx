import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

export const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // We check token on mount and also set up an interval to watch for token presence
    // this handles login/logout without a full page refresh if the app routes internally
    let currentToken = localStorage.getItem('token');
    let socketInstance: Socket | null = null;

    const connectSocket = (token: string) => {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const newSocket = io(API_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnected(false);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        if (err.message.includes('Authentication error')) {
          // Token is likely invalid/expired
          newSocket.disconnect();
        }
      });

      // Global UI Notification Listeners
      newSocket.on('order:new', (payload, callback) => {
        toast.success(`New order received from ${payload.buyerName}! Amount: ₹${payload.totalAmount}`, {
          duration: 6000,
          position: 'top-right',
        });
        if (typeof callback === 'function') callback('ACK');
      });

      newSocket.on('order:update', (payload, callback) => {
        toast(`Order #${payload.orderId} status updated to: ${payload.status}`, {
          icon: '📦',
          duration: 5000,
          position: 'top-right',
        });
        if (typeof callback === 'function') callback('ACK');
      });

      newSocket.on('order:cancelled', (payload, callback) => {
        toast.error(payload.message || `Order #${payload.orderId} was cancelled. Refund will be credited in 3 business days.`, {
          duration: 10000,
          position: 'top-right',
          icon: '💸',
        });
        if (typeof callback === 'function') callback('ACK');
      });

      newSocket.on('message:new', (payload, callback) => {
        toast.success(`New AI Message: ${payload.content}`, {
          icon: '💬',
          duration: 6000,
          position: 'top-right',
        });
        if (typeof callback === 'function') callback('ACK');
      });

      setSocket(newSocket);
      socketInstance = newSocket;
    };

    if (currentToken) {
      connectSocket(currentToken);
    }

    // Interval to detect token changes (e.g. login/logout)
    const interval = setInterval(() => {
      const newToken = localStorage.getItem('token');
      if (newToken !== currentToken) {
        currentToken = newToken;
        if (socketInstance) {
          socketInstance.disconnect();
          socketInstance = null;
          setSocket(null);
          setConnected(false);
        }
        if (newToken) {
          connectSocket(newToken);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
