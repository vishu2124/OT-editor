import React, { useState } from 'react';
import './DocumentList.css';

interface DocumentListProps {
  onDocumentSelect: (documentId: string) => void;
  onCreateDocument: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ onDocumentSelect, onCreateDocument }) => {
  const [documentId, setDocumentId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleJoinDocument = () => {
    if (documentId.trim()) {
      onDocumentSelect(documentId.trim());
    }
  };

  const handleCreateDocument = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Document',
          content: '',
          userId: 'client-user'
        })
      });
      
      if (response.ok) {
        const document = await response.json();
        setDocumentId(document.id);
        onCreateDocument();
        onDocumentSelect(document.id);
      } else {
        console.error('Failed to create document');
      }
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="document-list-container">
      <div className="document-list-header">
        <h1>OT.js Collaborative Editor</h1>
        <p>Real-time collaborative document editing using Operational Transformation</p>
      </div>

      <div className="document-actions">
        <div className="action-section">
          <h3>Create New Document</h3>
          <p>Start a new collaborative document</p>
          <button 
            className="btn btn-primary"
            onClick={handleCreateDocument}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Document'}
          </button>
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="action-section">
          <h3>Join Existing Document</h3>
          <p>Enter a document ID to join an existing document</p>
          <div className="join-form">
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Enter document ID..."
              className="document-id-input"
            />
            <button 
              className="btn btn-secondary"
              onClick={handleJoinDocument}
              disabled={!documentId.trim()}
            >
              Join Document
            </button>
          </div>
        </div>
      </div>

      <div className="features">
        <h3>Features</h3>
        <ul>
          <li>✅ Real-time collaborative editing</li>
          <li>✅ Operational Transformation (OT) for conflict resolution</li>
          <li>✅ Multi-user support with presence indicators</li>
          <li>✅ Document persistence</li>
          <li>✅ Cursor position tracking</li>
          <li>✅ Version control</li>
        </ul>
      </div>
    </div>
  );
};
