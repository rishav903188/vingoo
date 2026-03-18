import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { serverUrl } from '../App';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userData?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket instance with better configuration
    const socketInstance = io(serverUrl, { 
      withCredentials: true,
      transports: ['websocket', 'polling'], // Fallback transports
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    
    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      if (userData) {
        socketInstance.emit('identity', { userId: userData._id });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Socket reconnection failed:', error);
    });

    // Handle global socket events here if needed
    // For example, order status updates, etc.

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userData?._id, dispatch]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};