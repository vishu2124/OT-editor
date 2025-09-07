import React, { useState } from 'react';
import { DocumentList } from './components/DocumentList';
import { DocumentEditor } from './components/DocumentEditor';
import './App.css';

function App() {
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDocumentSelect = (documentId: string) => {
    setCurrentDocumentId(documentId);
    setError(null);
  };

  const handleCreateDocument = () => {
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleBackToList = () => {
    setCurrentDocumentId(null);
    setError(null);
  };

  if (currentDocumentId) {
    return (
      <div className="App">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        <div className="editor-header">
          <button onClick={handleBackToList} className="back-button">
            ← Back to Documents
          </button>
        </div>
        <DocumentEditor 
          documentId={currentDocumentId} 
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <div className="App">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      <DocumentList 
        onDocumentSelect={handleDocumentSelect}
        onCreateDocument={handleCreateDocument}
      />
    </div>
  );
}

export default App;
