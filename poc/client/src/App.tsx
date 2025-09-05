import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import DocumentEditor from './components/DocumentEditor';
import DocumentList from './components/DocumentList';
import { FlagProvider } from './contexts/FlagContext';

import './App.css';

const App: React.FC = () => {
  const [flags, setFlags] = useState<any[]>([]);

  const addFlag = (flag: any) => {
    setFlags(prev => [...prev, { ...flag, id: Date.now() }]);
  };

  const removeFlag = (id: number) => {
    setFlags(prev => prev.filter(flag => flag.id !== id));
  };

  return (
    <FlagProvider value={{ addFlag, removeFlag }}>
      <Router>
        <div className="App">
          <header className="app-header">
            <div className="header-content">
              <div className="header-left">
                <h1>📝 Confluence Clone POC</h1>
              </div>
              <div className="header-right">
                <button 
                  className="btn btn-primary" 
                  onClick={() => window.location.href = '/'}
                >
                  Home
                </button>
              </div>
            </div>
          </header>
          
          <main className="app-main">
            <Routes>
              <Route path="/" element={<DocumentList />} />
              <Route path="/document/:id" element={<DocumentEditor />} />
            </Routes>
          </main>
          
          <div className="flags-container">
            {flags.map(flag => (
              <div key={flag.id} className={`flag flag-${flag.appearance}`}>
                <div className="flag-content">
                  <h4>{flag.title}</h4>
                  <p>{flag.description}</p>
                </div>
                <button 
                  className="flag-close"
                  onClick={() => removeFlag(flag.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </Router>
    </FlagProvider>
  );
};

export default App;
