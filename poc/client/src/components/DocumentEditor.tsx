import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFlag } from '../contexts/FlagContext';
import { useCollaboration } from '../hooks/useCollaboration';
import { useDocument } from '../hooks/useDocument';
import { User } from '../types/User';
import { DocumentOperation } from '../types/DocumentOperation';

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addFlag } = useFlag();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Untitled Document');
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastCursorPosition = useRef(0);

  const { 
    socket,
    isConnected, 
    documentState,
    joinDocument, 
    sendOperation, 
    sendCursorUpdate,
    disconnect,
    getDocumentStats
  } = useCollaboration();

  const { loadDocument } = useDocument();

  // Remove the old loadDocumentData call - we use enhanced collaboration now
  // useEffect(() => {
  //   if (id) {
  //     loadDocumentData();
  //   }
  // }, [id]);

  useEffect(() => {
    if (id && isConnected) {
      joinDocument(id);
    }
  }, [id, isConnected]);

  // Handle document state updates from enhanced collaboration
  useEffect(() => {
    if (documentState) {
      setContent(documentState.content);
      setActiveUsers(documentState.activeUsers);
      setTitle(documentState.metadata?.title || title);
      setIsLoading(false);
    }
  }, [documentState]);

  // Setup WebSocket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleOperation = (data: { operation: DocumentOperation; user: any }) => {
      console.log('Received operation:', data.operation);
      applyOperation(data.operation);
    };

    const handleOperationImmediate = (data: { operation: DocumentOperation; tempContent: string; user: any }) => {
      console.log('Received immediate operation:', data.operation);
      setContent(data.tempContent);
    };

    const handleDocumentSync = (data: { content: string; version: number; operations: DocumentOperation[]; metadata: any }) => {
      console.log('Document sync:', data.version);
      setContent(data.content);
    };

    const handleUserJoined = (user: any) => {
      console.log('User joined:', user);
      setActiveUsers(prev => {
        const exists = prev.find(u => u.socketId === user.socketId);
        if (!exists) {
          return [...prev, user];
        }
        return prev;
      });
    };

    const handleUserLeft = (user: any) => {
      console.log('User left:', user);
      setActiveUsers(prev => prev.filter(u => u.socketId !== user.socketId));
    };

    const handleUsersUpdated = (data: { activeUsers: User[] }) => {
      console.log('Users updated:', data.activeUsers);
      setActiveUsers(data.activeUsers);
    };

    const handleCursorUpdate = (data: { user: any; cursor: any; timestamp: number }) => {
      console.log('Cursor update:', data);
      // Handle cursor position updates from other users
    };

    // Add event listeners
    socket.on('operation', handleOperation);
    socket.on('operation-immediate', handleOperationImmediate);
    socket.on('document-sync', handleDocumentSync);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('users-updated', handleUsersUpdated);
    socket.on('cursor-update', handleCursorUpdate);

    return () => {
      // Cleanup event listeners
      socket.off('operation', handleOperation);
      socket.off('operation-immediate', handleOperationImmediate);
      socket.off('document-sync', handleDocumentSync);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('users-updated', handleUsersUpdated);
      socket.off('cursor-update', handleCursorUpdate);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const loadDocumentData = async () => {
    if (!id) return;
    
    try {
      const document = await loadDocument(id);
      if (document) {
        setContent(document.content);
        setTitle(document.title);
      } else {
        addFlag({
          title: 'Error',
          description: 'Document not found',
          appearance: 'error'
        });
        navigate('/');
      }
    } catch (error) {
      addFlag({
        title: 'Error',
        description: 'Failed to load document',
        appearance: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    
    // Calculate operation based on content change
    const oldContent = content;
    const operation = calculateOperation(oldContent, newContent, lastCursorPosition.current);
    
    if (operation && id) {
      sendOperation(id, operation);
    }
  };

  const calculateOperation = (
    oldContent: string, 
    newContent: string, 
    cursorPos: number
  ): DocumentOperation | null => {
    return findTextDifference(oldContent, newContent);
  };

  const findTextDifference = (oldText: string, newText: string): DocumentOperation | null => {
    // Find the first different character
    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
      start++;
    }
    
    // Find the last different character from the end
    let oldEnd = oldText.length;
    let newEnd = newText.length;
    while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    
    if (start === oldEnd && start === newEnd) {
      return null; // No change
    }
    
    if (newText.length > oldText.length) {
      // Insertion
      return {
        type: 'insert',
        position: start,
        content: newText.slice(start, newEnd),
        timestamp: Date.now()
      };
    } else if (newText.length < oldText.length) {
      // Deletion
      return {
        type: 'delete',
        position: start,
        length: oldEnd - start,
        timestamp: Date.now()
      };
    } else {
      // Replacement (delete + insert)
      return {
        type: 'replace',
        position: start,
        length: oldEnd - start,
        content: newText.slice(start, newEnd),
        timestamp: Date.now()
      };
    }
  };

  const handleCursorMove = (position: number) => {
    lastCursorPosition.current = position;
    if (id) {
      sendCursorUpdate(id, { position });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      copyShareLink();
    }
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/document/${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      addFlag({
        title: 'Share Link Copied',
        description: 'Document link copied to clipboard',
        appearance: 'success'
      });
    });
  };

  const handleUserJoined = (user: User) => {
    setActiveUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (!exists) {
        return [...prev, user];
      }
      return prev;
    });
  };

  const handleUserLeft = (user: User) => {
    setActiveUsers(prev => prev.filter(u => u.id !== user.id));
  };

  const applyOperation = (operation: DocumentOperation) => {
    // Apply operation to content
    let newContent = content;
    
    if (operation.type === 'insert') {
      newContent = content.slice(0, operation.position) + 
                   operation.content + 
                   content.slice(operation.position);
    } else if (operation.type === 'delete') {
      newContent = content.slice(0, operation.position) + 
                   content.slice(operation.position + (operation.length || 0));
    } else if (operation.type === 'replace') {
      newContent = content.slice(0, operation.position) + 
                   operation.content + 
                   content.slice(operation.position + (operation.length || 0));
    }
    
    setContent(newContent);
  };

  if (isLoading) {
    return (
      <div className="loading">
        <h3>Loading document...</h3>
      </div>
    );
  }

  return (
    <div>
      <header className="document-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/')}
            >
              ← Back
            </button>
            <h2>{title}</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#6B778C', fontSize: '14px' }}>
                {activeUsers.length} user{activeUsers.length !== 1 ? 's' : ''} online
              </span>
              {activeUsers.map(user => (
                <div key={user.id} className="user-avatar" style={{ backgroundColor: user.color }} title={user.name}>
                  {user.avatar}
                </div>
              ))}
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={copyShareLink}
            >
              Share
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            minHeight: '500px',
            padding: '16px',
            border: '1px solid #DFE1E6',
            borderRadius: '8px',
            outline: 'none',
            fontSize: '16px',
            lineHeight: '1.5',
            backgroundColor: 'white',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
          onInput={(e) => {
            const target = e.target as HTMLDivElement;
            handleContentChange(target.textContent || '');
          }}
          onKeyDown={handleKeyDown}
          onMouseUp={() => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const position = range.startOffset;
              handleCursorMove(position);
            }
          }}
          onKeyUp={() => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const position = range.startOffset;
              handleCursorMove(position);
            }
          }}
          dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
        />
        
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: '#F4F5F7', 
          borderRadius: '6px',
          fontSize: '14px',
          color: '#6B778C'
        }}>
          💡 Tip: Press Ctrl+Enter to copy the share link
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
