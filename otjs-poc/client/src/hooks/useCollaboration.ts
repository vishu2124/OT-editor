import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DocumentState, User, CursorUpdate } from '../types';

interface UseCollaborationProps {
  documentId: string;
  onError?: (error: string) => void;
}

export const useCollaboration = ({ documentId, onError }: UseCollaborationProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [documentState, setDocumentState] = useState<DocumentState | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const isApplyingOperationRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('document-state', (data: DocumentState) => {
      console.log('Received document state:', data);
      console.log('Content length:', data.content.length);
      setDocumentState(data);
      setActiveUsers(data.activeUsers);
      setIsLoading(false);
    });

    newSocket.on('operation', (data: { operation: any; version: number; userId: string }) => {
      // For now, we'll let the server handle all OT operations
      // The server will send back the updated document state
      console.log('Received operation from server:', data);
    });

    newSocket.on('user-joined', (user: User) => {
      console.log('User joined:', user);
      setActiveUsers(prev => [...prev, user]);
    });

    newSocket.on('user-left', (user: User) => {
      console.log('User left:', user);
      setActiveUsers(prev => prev.filter(u => u.socketId !== user.socketId));
    });

    newSocket.on('cursor-update', (data: CursorUpdate) => {
      setActiveUsers(prev => prev.map(user => 
        user.socketId === data.user.socketId 
          ? { ...user, cursor: data.cursor }
          : user
      ));
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('Server error:', data.message);
      onError?.(data.message);
    });

    return () => {
      newSocket.close();
    };
  }, [documentId, onError]);

  // Join document
  const joinDocument = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('join-document', { documentId });
    }
  }, [socket, isConnected, documentId]);

  // Send operation
  const sendOperation = useCallback((operation: any) => {
    if (socket && isConnected && !isApplyingOperationRef.current) {
      socket.emit('operation', {
        documentId,
        operation
      });
    }
  }, [socket, isConnected, documentId]);

  // Update cursor
  const updateCursor = useCallback((cursor: { position: number; selection: number | null }) => {
    if (socket && isConnected) {
      socket.emit('cursor-update', {
        documentId,
        cursor
      });
    }
  }, [socket, isConnected, documentId]);

  // Apply text change - simplified version
  const applyTextChange = useCallback((oldText: string, newText: string, selectionStart: number) => {
    if (socket && isConnected && !isApplyingOperationRef.current) {
      try {
        // Create a simple operation object
        const operation = {
          type: 'text-change',
          oldText,
          newText,
          selectionStart,
          timestamp: Date.now()
        };
        
        sendOperation(operation);
      } catch (error) {
        console.error('Error creating operation:', error);
        onError?.('Failed to create operation');
      }
    }
  }, [sendOperation, onError, socket, isConnected]);

  return {
    socket,
    isConnected,
    documentState,
    activeUsers,
    isLoading,
    joinDocument,
    sendOperation,
    updateCursor,
    applyTextChange
  };
};
