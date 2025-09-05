const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { EnhancedDocumentManager } = require('./enhanced-document-manager');
const { EnhancedOTService, DocumentOperation } = require('./ot-service');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const DOCUMENTS_DIR = path.join(__dirname, 'documents');

// Ensure documents directory exists
fs.ensureDirSync(DOCUMENTS_DIR);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Initialize enhanced document manager
const documentManager = new EnhancedDocumentManager(DOCUMENTS_DIR);

// Generate dummy user data
const generateDummyUser = () => {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  
  const name = names[Math.floor(Math.random() * names.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return {
    id: uuidv4(),
    name,
    color,
    avatar: name.charAt(0).toUpperCase()
  };
};

// Cleanup interval for inactive documents
setInterval(() => {
  documentManager.cleanupInactiveDocuments();
}, 10 * 60 * 1000); // Every 10 minutes

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await documentManager.saveAllDocuments();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await documentManager.saveAllDocuments();
  process.exit(0);
});

// Enhanced API Routes using the new document manager

app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentManager.loadDocument(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      activeUsers: Array.from(document.activeUsers.values()),
      metadata: document.metadata
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const { title, content, userId } = req.body;
    const document = await documentManager.createDocument(title, userId);
    
    // If initial content is provided, set it
    if (content) {
      document.content = content;
      document.metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      document.metadata.characterCount = content.length;
      await documentManager.saveDocument(document);
    }
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      metadata: document.metadata
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/documents/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = documentManager.getDocumentStats(id);
    
    if (!stats) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching document stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-document', async (data) => {
    const { documentId } = data;
    const user = generateDummyUser();
    
    try {
      // Add user to document using enhanced manager
      const document = await documentManager.addUserToDocument(documentId, socket.id, user);
      
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }
      
      // Join socket room
      socket.join(documentId);
      
      // Send current document state
      socket.emit('document-state', {
        content: document.content,
        version: document.version,
        metadata: document.metadata,
        activeUsers: Array.from(document.activeUsers.entries()).map(([socketId, userData]) => ({
          ...userData,
          socketId: socketId,
          cursor: userData.cursor || { position: 0, selection: null }
        }))
      });
      
      // Notify other users
      socket.to(documentId).emit('user-joined', {
        ...user,
        socketId: socket.id
      });
      
      // Broadcast updated user list to all users in the room
      io.to(documentId).emit('users-updated', {
        activeUsers: Array.from(document.activeUsers.entries()).map(([socketId, userData]) => ({
          ...userData,
          socketId: socketId,
          cursor: userData.cursor || { position: 0, selection: null }
        }))
      });
      
      console.log(`User ${user.name} joined document ${documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  });

  socket.on('operation', async (data) => {
    const userSession = documentManager.userSessions.get(socket.id);
    if (!userSession) return;
    
    const { documentId, operation } = data;
    
    try {
      // Create operation object with enhanced properties
      const op = new DocumentOperation(
        operation.type,
        operation.position,
        operation.content,
        operation.length,
        userSession.id,
        Date.now(),
        socket.id // clientId for tracking
      );
      
      // Queue operation with debouncing
      const transformedOp = await documentManager.queueOperation(documentId, op, socket, io);
      
      if (transformedOp) {
        console.log(`Operation queued by ${userSession.name}:`, transformedOp.type, 'at position', transformedOp.position);
      }
    } catch (error) {
      console.error('Error processing operation:', error);
      socket.emit('error', { message: 'Failed to process operation' });
    }
  });

  socket.on('cursor-update', (data) => {
    const userSession = documentManager.userSessions.get(socket.id);
    if (!userSession) return;
    
    const { documentId, cursor } = data;
    
    // Update user's cursor position using enhanced manager
    documentManager.updateUserCursor(documentId, socket.id, cursor);
    
    // Broadcast cursor update to other users
    socket.to(documentId).emit('cursor-update', {
      user: userSession,
      cursor: cursor,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', async () => {
    const userSession = documentManager.userSessions.get(socket.id);
    if (userSession) {
      const { documentId } = userSession;
      
      try {
        // Remove user from document using enhanced manager
        await documentManager.removeUserFromDocument(documentId, socket.id);
        
        // Notify other users
        socket.to(documentId).emit('user-left', {
          ...userSession,
          socketId: socket.id
        });
        
        // Get updated document for broadcasting user list
        const document = documentManager.activeDocuments.get(documentId);
        if (document) {
          // Broadcast updated user list to all users in the room
          io.to(documentId).emit('users-updated', {
            activeUsers: Array.from(document.activeUsers.entries()).map(([socketId, userData]) => ({
              ...userData,
              socketId: socketId,
              cursor: userData.cursor || { position: 0, selection: null }
            }))
          });
        }
        
        console.log(`User ${userSession.name} disconnected from document ${documentId}`);
      } catch (error) {
        console.error('Error handling user disconnect:', error);
      }
    } else {
      console.log(`Unknown user disconnected: ${socket.id}`);
    }
  });
});

// Serve test HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../test.html'));
});

// Serve React app (only in production)
if (process.env.NODE_ENV === 'production') {
  app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
} else {
  // In development, serve test page
  app.get('/app', (req, res) => {
    res.json({ 
      message: 'Backend server running. Please start the React development server on port 3000.',
      frontend: 'http://localhost:3000'
    });
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Documents directory: ${DOCUMENTS_DIR}`);
});
