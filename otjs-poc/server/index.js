const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const ot = require('ot');

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

// Store active documents and their OT servers
const documents = new Map();
const userSessions = new Map();

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

// Document management functions
const loadDocument = async (documentId) => {
  try {
    const filePath = path.join(DOCUMENTS_DIR, `${documentId}.json`);
    if (await fs.pathExists(filePath)) {
      const data = await fs.readJson(filePath);
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error loading document:', error);
    return null;
  }
};

const saveDocument = async (documentId, document) => {
  try {
    const filePath = path.join(DOCUMENTS_DIR, `${documentId}.json`);
    await fs.writeJson(filePath, document, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('Error saving document:', error);
    return false;
  }
};

const createDocument = async (title, userId) => {
  const documentId = uuidv4();
  const document = {
    id: documentId,
    title: title || 'Untitled Document',
    content: '',
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
    activeUsers: new Map()
  };
  
  // Create OT server for this document
  const otServer = new ot.Server(document.content);
  documents.set(documentId, {
    ...document,
    otServer,
    activeUsers: new Map()
  });
  
  await saveDocument(documentId, document);
  return document;
};

const getOrCreateDocument = async (documentId) => {
  let document = documents.get(documentId);
  
  if (!document) {
    const savedDoc = await loadDocument(documentId);
    if (savedDoc) {
      const otServer = new ot.Server(savedDoc.content);
      document = {
        ...savedDoc,
        otServer,
        activeUsers: new Map()
      };
      documents.set(documentId, document);
    } else {
      // Create new document if it doesn't exist
      document = await createDocument('Untitled Document', 'system');
    }
  }
  
  return document;
};

// API Routes
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await getOrCreateDocument(id);
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      activeUsers: Array.from(document.activeUsers.values())
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const { title, content, userId } = req.body;
    const document = await createDocument(title, userId);
    
    // Ensure the document is stored in the documents Map
    if (!documents.has(document.id)) {
      const otServer = new ot.Server(document.content);
      documents.set(document.id, {
        ...document,
        otServer,
        activeUsers: new Map()
      });
    }
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    });
  } catch (error) {
    console.error('Error creating document:', error);
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
      const document = await getOrCreateDocument(documentId);
      
      // Add user to document
      document.activeUsers.set(socket.id, {
        ...user,
        socketId: socket.id,
        cursor: { position: 0, selection: null }
      });
      
      // Store user session
      userSessions.set(socket.id, {
        id: user.id,
        name: user.name,
        color: user.color,
        avatar: user.avatar,
        documentId: documentId
      });
      
      // Join socket room
      socket.join(documentId);
      
      // Send current document state
      socket.emit('document-state', {
        content: document.content,
        version: document.version,
        activeUsers: Array.from(document.activeUsers.values())
      });
      
      // Notify other users
      socket.to(documentId).emit('user-joined', {
        ...user,
        socketId: socket.id
      });
      
      console.log(`User ${user.name} joined document ${documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  });

  socket.on('operation', async (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;
    
    const { documentId, operation } = data;
    const document = documents.get(documentId);
    
    if (!document) return;
    
    try {
      // Handle different operation types
      if (operation.type === 'text-change') {
        // For text changes, update the document content directly
        document.content = operation.newText;
        document.version++;
        document.updatedAt = new Date().toISOString();
        
        // Save document
        await saveDocument(documentId, {
          id: document.id,
          title: document.title,
          content: document.content,
          version: document.version,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          createdBy: document.createdBy
        });
        
        // Broadcast updated document state to all clients
        io.to(documentId).emit('document-state', {
          content: document.content,
          version: document.version,
          activeUsers: Array.from(document.activeUsers.values())
        });
        
        console.log(`Text change applied by ${userSession.name}: ${operation.newText.length} characters`);
      } else {
        // Handle other operation types with OT server
        try {
          const transformedOps = document.otServer.receiveOperation(operation);
          
          // Update document content
          document.content = document.otServer.document;
          document.version++;
          document.updatedAt = new Date().toISOString();
          
          // Save document
          await saveDocument(documentId, {
            id: document.id,
            title: document.title,
            content: document.content,
            version: document.version,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            createdBy: document.createdBy
          });
          
          // Broadcast operation to other clients
          socket.to(documentId).emit('operation', {
            operation: transformedOps,
            version: document.version,
            userId: userSession.id
          });
          
          console.log(`Operation applied by ${userSession.name}:`, operation.type);
        } catch (otError) {
          console.error('OT processing error:', otError);
          // Fallback to simple text update
          document.content = operation.newText || document.content;
          document.version++;
          document.updatedAt = new Date().toISOString();
          
          // Save document
          await saveDocument(documentId, {
            id: document.id,
            title: document.title,
            content: document.content,
            version: document.version,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            createdBy: document.createdBy
          });
          
          // Broadcast updated document state to all clients
          io.to(documentId).emit('document-state', {
            content: document.content,
            version: document.version,
            activeUsers: Array.from(document.activeUsers.values())
          });
          
          console.log(`Fallback text update applied by ${userSession.name}`);
        }
      }
    } catch (error) {
      console.error('Error processing operation:', error);
      socket.emit('error', { message: 'Failed to process operation' });
    }
  });

  socket.on('cursor-update', (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;
    
    const { documentId, cursor } = data;
    const document = documents.get(documentId);
    
    if (document && document.activeUsers.has(socket.id)) {
      // Update user's cursor position
      document.activeUsers.get(socket.id).cursor = cursor;
      
      // Broadcast cursor update to other users
      socket.to(documentId).emit('cursor-update', {
        user: userSession,
        cursor: cursor,
        timestamp: Date.now()
      });
    }
  });

  socket.on('disconnect', async () => {
    const userSession = userSessions.get(socket.id);
    if (userSession) {
      const { documentId } = userSession;
      const document = documents.get(documentId);
      
      if (document) {
        // Remove user from document
        document.activeUsers.delete(socket.id);
        
        // Notify other users
        socket.to(documentId).emit('user-left', {
          ...userSession,
          socketId: socket.id
        });
        
        console.log(`User ${userSession.name} disconnected from document ${documentId}`);
      }
      
      // Clean up user session
      userSessions.delete(socket.id);
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

// Cleanup interval for inactive documents
setInterval(() => {
  // Clean up documents that have no active users
  for (const [documentId, document] of documents.entries()) {
    if (document.activeUsers.size === 0) {
      documents.delete(documentId);
      console.log(`Cleaned up inactive document: ${documentId}`);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  // Save all active documents
  for (const [documentId, document] of documents.entries()) {
    await saveDocument(documentId, {
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      createdBy: document.createdBy
    });
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  // Save all active documents
  for (const [documentId, document] of documents.entries()) {
    await saveDocument(documentId, {
      id: document.id,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      createdBy: document.createdBy
    });
  }
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`OT.js Server running on port ${PORT}`);
  console.log(`Documents directory: ${DOCUMENTS_DIR}`);
});
