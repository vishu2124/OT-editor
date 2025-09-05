const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { EnhancedOTService, DocumentOperation } = require('./ot-service');

/**
 * Enhanced Document Manager with Confluence-like patterns
 */
class EnhancedDocumentManager {
  constructor(documentsDir) {
    this.documentsDir = documentsDir;
    this.activeDocuments = new Map();
    this.operationQueues = new Map(); // documentId -> operations[]
    this.debouncedSaves = new Map(); // documentId -> timeout
    this.userSessions = new Map(); // socketId -> user session
    this.DEBOUNCE_DELAY = 500; // 500ms debounce
  }

  /**
   * Create a new document
   */
  async createDocument(title = 'Untitled Document', userId = null) {
    const docId = uuidv4();
    const document = {
      id: docId,
      title,
      content: '',
      operations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      activeUsers: new Map(),
      metadata: {
        createdBy: userId,
        lastModifiedBy: userId,
        wordCount: 0,
        characterCount: 0,
        status: 'draft' // draft, published, archived
      }
    };

    await this.saveDocument(document);
    this.activeDocuments.set(docId, document);
    this.operationQueues.set(docId, []);
    
    return document;
  }

  /**
   * Load document from storage
   */
  async loadDocument(docId) {
    try {
      // Check if already in memory
      if (this.activeDocuments.has(docId)) {
        return this.activeDocuments.get(docId);
      }

      const filePath = path.join(this.documentsDir, `${docId}.json`);
      
      // Check if file exists before trying to read
      if (!await fs.pathExists(filePath)) {
        console.log(`Document ${docId} not found, creating new document`);
        return await this.createDocument(`Document ${docId}`, null);
      }
      
      const data = await fs.readFile(filePath, 'utf8');
      
      // Check if file is empty or contains invalid JSON
      if (!data.trim()) {
        console.log(`Document ${docId} is empty, creating new document`);
        return await this.createDocument(`Document ${docId}`, null);
      }
      
      const document = JSON.parse(data);
      
      // Convert activeUsers Map from object
      if (document.activeUsers && typeof document.activeUsers === 'object') {
        document.activeUsers = new Map(Object.entries(document.activeUsers));
      } else {
        document.activeUsers = new Map();
      }
      
      // Initialize operation queue if not exists
      if (!this.operationQueues.has(docId)) {
        this.operationQueues.set(docId, []);
      }
      
      this.activeDocuments.set(docId, document);
      return document;
    } catch (error) {
      console.error('Error loading document:', error);
      // If there's a JSON parse error or other issue, create a new document
      if (error instanceof SyntaxError) {
        console.log(`Invalid JSON in document ${docId}, creating new document`);
        return await this.createDocument(`Document ${docId}`, null);
      }
      return null;
    }
  }

  /**
   * Save document to storage
   */
  async saveDocument(document) {
    try {
      // Ensure documents directory exists
      await fs.ensureDir(this.documentsDir);
      
      const filePath = path.join(this.documentsDir, `${document.id}.json`);
      const dataToSave = {
        ...document,
        activeUsers: Object.fromEntries(document.activeUsers || new Map()),
        lastSaved: new Date().toISOString()
      };
      
      // Write to a temporary file first, then rename for atomic operation
      const tempFilePath = `${filePath}.tmp`;
      await fs.writeFile(tempFilePath, JSON.stringify(dataToSave, null, 2), 'utf8');
      await fs.rename(tempFilePath, filePath);
      
      console.log(`Document ${document.id} saved successfully`);
    } catch (error) {
      console.error('Error saving document:', error);
      // Try to clean up temp file if it exists
      try {
        await fs.remove(`${path.join(this.documentsDir, `${document.id}.json`)}.tmp`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Add operation to queue with debouncing
   */
  async queueOperation(documentId, operation, socket, io) {
    const document = this.activeDocuments.get(documentId);
    if (!document) {
      console.error('Document not found:', documentId);
      return null;
    }

    const queue = this.operationQueues.get(documentId) || [];
    
    // Add operation to queue
    queue.push(operation);
    this.operationQueues.set(documentId, queue);

    // Clear existing debounced save
    if (this.debouncedSaves.has(documentId)) {
      clearTimeout(this.debouncedSaves.get(documentId));
    }

    // Set new debounced save
    const timeout = setTimeout(async () => {
      await this.processOperationQueue(documentId, socket, io);
    }, this.DEBOUNCE_DELAY);
    
    this.debouncedSaves.set(documentId, timeout);

    // Apply operation immediately for real-time feedback
    return this.applyOperationImmediate(document, operation, socket, io);
  }

  /**
   * Process queued operations with proper OT
   */
  async processOperationQueue(documentId, socket, io) {
    const document = this.activeDocuments.get(documentId);
    const queue = this.operationQueues.get(documentId) || [];
    
    if (!document || queue.length === 0) {
      return;
    }

    console.log(`Processing ${queue.length} queued operations for document ${documentId}`);

    try {
      // Group operations by user for better merging
      const operationsByUser = new Map();
      queue.forEach(op => {
        const userId = op.userId;
        if (!operationsByUser.has(userId)) {
          operationsByUser.set(userId, []);
        }
        operationsByUser.get(userId).push(op);
      });

      // Process each user's operations
      const processedOperations = [];
      for (const [userId, userOps] of operationsByUser) {
        // Try to merge consecutive operations
        const merged = EnhancedOTService.mergeOperations(userOps);
        if (Array.isArray(merged)) {
          processedOperations.push(...merged);
        } else if (merged) {
          processedOperations.push(merged);
        }
      }

      // Sort operations by timestamp
      processedOperations.sort((a, b) => a.timestamp - b.timestamp);

      // Apply operations with proper transformation
      let currentContent = document.content;
      const appliedOperations = [];

      for (const operation of processedOperations) {
        // Transform against already applied operations
        const transformedOp = EnhancedOTService.transformAgainstOperations(
          operation,
          appliedOperations
        );

        if (transformedOp) {
          currentContent = EnhancedOTService.applyOperation(currentContent, transformedOp);
          transformedOp.applied = true;
          appliedOperations.push(transformedOp);
          document.operations.push(transformedOp);
        }
      }

      // Update document
      document.content = currentContent;
      document.version++;
      document.updatedAt = new Date().toISOString();
      document.metadata.wordCount = currentContent.split(/\s+/).filter(word => word.length > 0).length;
      document.metadata.characterCount = currentContent.length;

      // Save document
      await this.saveDocument(document);

      // Broadcast final state to all users
      io.to(documentId).emit('document-sync', {
        content: document.content,
        version: document.version,
        operations: appliedOperations,
        metadata: document.metadata
      });

      // Clear processed queue
      this.operationQueues.set(documentId, []);
      this.debouncedSaves.delete(documentId);

    } catch (error) {
      console.error('Error processing operation queue:', error);
    }
  }

  /**
   * Apply operation immediately for real-time feedback
   */
  applyOperationImmediate(document, operation, socket, io) {
    try {
      // Transform operation against recent operations
      const recentOps = document.operations.slice(-10); // Last 10 operations
      const transformedOp = EnhancedOTService.transformAgainstOperations(operation, recentOps);

      if (!transformedOp) {
        return null; // Operation was cancelled/absorbed
      }

      // Apply to temporary content for immediate feedback
      const tempContent = EnhancedOTService.applyOperation(document.content, transformedOp);

      // Broadcast to other users immediately
      socket.to(document.id).emit('operation-immediate', {
        operation: transformedOp,
        tempContent: tempContent,
        user: this.userSessions.get(socket.id)
      });

      return transformedOp;
    } catch (error) {
      console.error('Error applying immediate operation:', error);
      return null;
    }
  }

  /**
   * Add user to document
   */
  async addUserToDocument(documentId, socketId, user) {
    const document = await this.loadDocument(documentId);
    if (!document) {
      return null;
    }

    // Add user to session tracking
    this.userSessions.set(socketId, { ...user, documentId, socketId });
    
    // Add user to document
    document.activeUsers.set(socketId, {
      ...user,
      joinedAt: new Date().toISOString(),
      cursor: { position: 0, selection: null }
    });

    // Update document metadata
    document.metadata.lastAccessedBy = user.id;
    document.metadata.lastAccessedAt = new Date().toISOString();

    await this.saveDocument(document);
    return document;
  }

  /**
   * Remove user from document
   */
  async removeUserFromDocument(documentId, socketId) {
    const document = this.activeDocuments.get(documentId);
    if (!document) {
      return;
    }

    // Remove user from document
    document.activeUsers.delete(socketId);
    this.userSessions.delete(socketId);

    // Process any remaining operations for this user
    const queue = this.operationQueues.get(documentId) || [];
    const userSession = this.userSessions.get(socketId);
    if (userSession && queue.some(op => op.userId === userSession.id)) {
      // Force process queue to handle user's final operations
      if (this.debouncedSaves.has(documentId)) {
        clearTimeout(this.debouncedSaves.get(documentId));
        this.debouncedSaves.delete(documentId);
        await this.processOperationQueue(documentId, null, null);
      }
    }

    await this.saveDocument(document);
  }

  /**
   * Update user cursor position
   */
  updateUserCursor(documentId, socketId, cursor) {
    const document = this.activeDocuments.get(documentId);
    if (!document || !document.activeUsers.has(socketId)) {
      return;
    }

    const user = document.activeUsers.get(socketId);
    user.cursor = cursor;
    user.lastCursorUpdate = new Date().toISOString();
    
    document.activeUsers.set(socketId, user);
  }

  /**
   * Get document statistics
   */
  getDocumentStats(documentId) {
    const document = this.activeDocuments.get(documentId);
    if (!document) {
      return null;
    }

    return {
      id: document.id,
      title: document.title,
      version: document.version,
      activeUsers: document.activeUsers.size,
      operationsCount: document.operations.length,
      queuedOperations: this.operationQueues.get(documentId)?.length || 0,
      metadata: document.metadata,
      lastUpdated: document.updatedAt
    };
  }

  /**
   * Force save all active documents
   */
  async saveAllDocuments() {
    const savePromises = [];
    for (const document of this.activeDocuments.values()) {
      savePromises.push(this.saveDocument(document));
    }
    await Promise.all(savePromises);
    console.log(`Saved ${savePromises.length} active documents`);
  }

  /**
   * Clean up inactive documents from memory
   */
  cleanupInactiveDocuments(maxIdleTime = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now();
    const documentsToCleanup = [];

    for (const [docId, document] of this.activeDocuments) {
      const lastUpdate = new Date(document.updatedAt).getTime();
      const hasActiveUsers = document.activeUsers.size > 0;
      
      if (!hasActiveUsers && (now - lastUpdate) > maxIdleTime) {
        documentsToCleanup.push(docId);
      }
    }

    for (const docId of documentsToCleanup) {
      this.activeDocuments.delete(docId);
      this.operationQueues.delete(docId);
      if (this.debouncedSaves.has(docId)) {
        clearTimeout(this.debouncedSaves.get(docId));
        this.debouncedSaves.delete(docId);
      }
    }

    if (documentsToCleanup.length > 0) {
      console.log(`Cleaned up ${documentsToCleanup.length} inactive documents from memory`);
    }
  }
}

module.exports = { EnhancedDocumentManager };
