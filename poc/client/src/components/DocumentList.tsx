import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlag } from '../contexts/FlagContext';

const DocumentList: React.FC = () => {
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { addFlag } = useFlag();

  const handleCreateDocument = async () => {
    if (!newDocumentTitle.trim()) {
      addFlag({
        title: 'Error',
        description: 'Please enter a document title',
        appearance: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newDocumentTitle }),
      });

      if (response.ok) {
        const document = await response.json();
        addFlag({
          title: 'Success',
          description: 'Document created successfully',
          appearance: 'success'
        });
        setIsCreateModalOpen(false);
        setNewDocumentTitle('');
        navigate(`/document/${document.id}`);
      } else {
        throw new Error('Failed to create document');
      }
    } catch (error) {
      addFlag({
        title: 'Error',
        description: 'Failed to create document',
        appearance: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinDocument = () => {
    const documentId = prompt('Enter document ID to join:');
    if (documentId) {
      navigate(`/document/${documentId}`);
    }
  };

  return (
    <div>
      <h2>Collaborative Documents</h2>
      
      <div style={{ maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '16px' }}>
          Welcome to Confluence Clone POC
        </h3>
        
        <p style={{ marginBottom: '24px', color: '#6B778C' }}>
          Create a new document or join an existing one using a share link. 
          All documents support real-time collaborative editing with automatic 
          conflict resolution.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create New Document
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={handleJoinDocument}
          >
            Join Document
          </button>
        </div>

        <div style={{ 
          padding: '16px', 
          backgroundColor: '#F4F5F7', 
          borderRadius: '8px',
          marginTop: '24px'
        }}>
          <h4 style={{ marginBottom: '8px' }}>
            Features
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Real-time collaborative editing</li>
            <li>Automatic conflict resolution</li>
            <li>User presence indicators</li>
            <li>Share via URL</li>
            <li>No database required (JSON file storage)</li>
          </ul>
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Document</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Document Title</label>
              <input
                className="form-input"
                type="text"
                value={newDocumentTitle}
                onChange={(e) => setNewDocumentTitle(e.target.value)}
                placeholder="Enter document title..."
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateDocument();
                  }
                }}
              />
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCreateDocument}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentList;
