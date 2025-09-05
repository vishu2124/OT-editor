import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User } from '../types/User';
import { DocumentOperation } from '../types/DocumentOperation';

interface DocumentState {
  content: string;
  version: number;
  metadata: any;
  activeUsers: User[];
}

interface OperationQueue {
  operations: DocumentOperation[];
  isProcessing: boolean;
}

export const useCollaboration = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [documentState, setDocumentState] = useState<DocumentState | null>(null);
  const operationQueue = useRef<OperationQueue>({ operations: [], isProcessing: false });
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    // Handle enhanced document state
    newSocket.on('document-state', (data: DocumentState) => {
      console.log('Received document state:', data);
      setDocumentState(data);
    });

    // Handle immediate operation feedback
    newSocket.on('operation-immediate', (data: { operation: DocumentOperation; tempContent: string; user: User }) => {
      console.log('Received immediate operation:', data.operation);
      // Update UI immediately for responsive feedback
      setDocumentState(prev => prev ? { ...prev, content: data.tempContent } : null);
    });

    // Handle document sync (final state after debounced processing)
    newSocket.on('document-sync', (data: { content: string; version: number; operations: DocumentOperation[]; metadata: any }) => {
      console.log('Received document sync:', data.version);
      setDocumentState(prev => prev ? {
        ...prev,
        content: data.content,
        version: data.version,
        metadata: data.metadata
      } : null);
    });

    // Handle user updates
    newSocket.on('users-updated', (data: { activeUsers: User[] }) => {
      setDocumentState(prev => prev ? { ...prev, activeUsers: data.activeUsers } : null);
    });

    // Handle errors
    newSocket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
    });

    setSocket(newSocket);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      newSocket.close();
    };
  }, []);

  const joinDocument = useCallback((documentId: string) => {
    if (socket) {
      console.log('Joining document:', documentId);
      socket.emit('join-document', { documentId });
    }
  }, [socket]);

  const sendOperation = useCallback((documentId: string, operation: DocumentOperation) => {
    if (socket && isConnected) {
      // Add to queue for debounced sending
      operationQueue.current.operations.push(operation);
      
      // Clear existing timeout
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      
      // Set new timeout for debounced sending
      debounceTimeout.current = setTimeout(() => {
        if (operationQueue.current.operations.length > 0) {
          // Send all queued operations
          operationQueue.current.operations.forEach(op => {
            socket.emit('operation', { documentId, operation: op });
          });
          
          console.log(`Sent ${operationQueue.current.operations.length} operations`);
          operationQueue.current.operations = [];
        }
      }, 100); // 100ms debounce
    }
  }, [socket, isConnected]);

  const sendCursorUpdate = useCallback((documentId: string, cursor: { position: number; selection?: any }) => {
    if (socket && isConnected) {
      socket.emit('cursor-update', { documentId, cursor });
    }
  }, [socket, isConnected]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
    }
  }, [socket]);

  const getDocumentStats = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/documents/${documentId}/stats`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching document stats:', error);
    }
    return null;
  }, []);

  return {
    socket,
    isConnected,
    documentState,
    joinDocument,
    sendOperation,
    sendCursorUpdate,
    disconnect,
    getDocumentStats
  };
};
