import React, { useState, useEffect, useRef } from 'react';
import { useCollaboration } from '../hooks/useCollaboration';
import './DocumentEditor.css';

interface DocumentEditorProps {
  documentId: string;
  onError?: (error: string) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId, onError }) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastContentRef = useRef('');

  const {
    isConnected,
    documentState,
    activeUsers,
    isLoading,
    joinDocument,
    applyTextChange,
    updateCursor
  } = useCollaboration({ documentId, onError });

  // Update content when document state changes
  useEffect(() => {
    if (documentState) {
      console.log('Document state updated:', documentState.content);
      setContent(documentState.content);
      lastContentRef.current = documentState.content;
    }
  }, [documentState]);

  // Join document when connected
  useEffect(() => {
    if (isConnected && !isLoading) {
      joinDocument();
    }
  }, [isConnected, isLoading, joinDocument]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isEditing) return;
    
    const newContent = e.target.value;
    const selectionStart = e.target.selectionStart;
    
    // Only update if the content is actually different from what we expect
    if (newContent !== lastContentRef.current) {
      setContent(newContent);
      applyTextChange(lastContentRef.current, newContent, selectionStart);
      lastContentRef.current = newContent;
    }
  };

  const handleSelectionChange = () => {
    if (textareaRef.current && isEditing) {
      updateCursor({
        position: textareaRef.current.selectionStart,
        selection: textareaRef.current.selectionEnd !== textareaRef.current.selectionStart 
          ? textareaRef.current.selectionEnd 
          : null
      });
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="editor-container">
        <div className="loading">Loading document...</div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        <div className="document-info">
          Document ID: {documentId}
        </div>
      </div>

      <div className="users-section">
        <h3>Active Users ({activeUsers.length})</h3>
        <div className="users-list">
          {activeUsers.map((user) => (
            <div key={user.socketId} className="user-item">
              <div 
                className="user-avatar" 
                style={{ backgroundColor: user.color }}
              >
                {user.avatar}
              </div>
              <span className="user-name">{user.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="editor-wrapper">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          onSelect={handleSelectionChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="document-editor"
          placeholder="Start typing to collaborate in real-time..."
          disabled={!isConnected}
        />
      </div>

      <div className="editor-footer">
        <div className="document-stats">
          Characters: {content.length} | Words: {content.split(/\s+/).filter(word => word.length > 0).length}
        </div>
        <div className="version-info">
          Version: {documentState?.version || 0}
        </div>
      </div>
    </div>
  );
};
