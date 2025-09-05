const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced Operational Transformation Service
 * Based on Confluence document mutation patterns
 */
class DocumentOperation {
  constructor(type, position, content, length, userId, timestamp, clientId = null) {
    this.type = type; // 'insert', 'delete', 'replace', 'retain'
    this.position = position;
    this.content = content;
    this.length = length;
    this.userId = userId;
    this.timestamp = timestamp;
    this.clientId = clientId;
    this.id = uuidv4();
    this.version = 1;
    this.applied = false;
  }

  clone() {
    const op = new DocumentOperation(
      this.type,
      this.position,
      this.content,
      this.length,
      this.userId,
      this.timestamp,
      this.clientId
    );
    op.id = this.id;
    op.version = this.version;
    op.applied = this.applied;
    return op;
  }
}

/**
 * Enhanced OT Service with Confluence-like patterns
 */
class EnhancedOTService {
  constructor() {
    this.pendingOperations = new Map(); // clientId -> operations[]
    this.appliedOperations = [];
    this.documentVersion = 0;
  }

  /**
   * Transform two operations against each other
   * @param {DocumentOperation} op1 - First operation
   * @param {DocumentOperation} op2 - Second operation
   * @param {boolean} op1HasPriority - Whether op1 has priority over op2
   * @returns {Array} - [transformed op1, transformed op2]
   */
  static transform(op1, op2, op1HasPriority = false) {
    // Handle identical operations
    if (op1.id === op2.id) {
      return [op1, null]; // Second operation is redundant
    }

    // Transform based on operation types
    switch (`${op1.type}-${op2.type}`) {
      case 'insert-insert':
        return EnhancedOTService.transformInsertInsert(op1, op2, op1HasPriority);
      case 'insert-delete':
        return EnhancedOTService.transformInsertDelete(op1, op2);
      case 'insert-replace':
        return EnhancedOTService.transformInsertReplace(op1, op2);
      case 'delete-insert':
        return EnhancedOTService.transformDeleteInsert(op1, op2);
      case 'delete-delete':
        return EnhancedOTService.transformDeleteDelete(op1, op2);
      case 'delete-replace':
        return EnhancedOTService.transformDeleteReplace(op1, op2);
      case 'replace-insert':
        return EnhancedOTService.transformReplaceInsert(op1, op2);
      case 'replace-delete':
        return EnhancedOTService.transformReplaceDelete(op1, op2);
      case 'replace-replace':
        return EnhancedOTService.transformReplaceReplace(op1, op2, op1HasPriority);
      default:
        return [op1, op2]; // No transformation needed
    }
  }

  static transformInsertInsert(op1, op2, op1HasPriority) {
    if (op1.position < op2.position || (op1.position === op2.position && op1HasPriority)) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else {
      return [new DocumentOperation(
        op1.type,
        op1.position + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    }
  }

  static transformInsertDelete(op1, op2) {
    if (op1.position <= op2.position) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else if (op1.position >= op2.position + (op2.length || 0)) {
      return [new DocumentOperation(
        op1.type,
        op1.position - (op2.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else {
      // Insert position is within delete range - move to delete start
      return [new DocumentOperation(
        op1.type,
        op2.position,
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    }
  }

  static transformInsertReplace(op1, op2) {
    if (op1.position <= op2.position) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else if (op1.position >= op2.position + (op2.length || 0)) {
      return [new DocumentOperation(
        op1.type,
        op1.position - (op2.length || 0) + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else {
      // Insert position is within replace range
      return [new DocumentOperation(
        op1.type,
        op2.position + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    }
  }

  static transformDeleteInsert(op1, op2) {
    if (op2.position <= op1.position) {
      return [new DocumentOperation(
        op1.type,
        op1.position + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else if (op2.position >= op1.position + (op1.length || 0)) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position - (op1.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else {
      // Insert position is within delete range
      return [op1, new DocumentOperation(
        op2.type,
        op1.position,
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    }
  }

  static transformDeleteDelete(op1, op2) {
    if (op1.position + (op1.length || 0) <= op2.position) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position - (op1.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else if (op2.position + (op2.length || 0) <= op1.position) {
      return [new DocumentOperation(
        op1.type,
        op1.position - (op2.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else {
      // Overlapping deletes - complex case
      const op1Start = op1.position;
      const op1End = op1.position + (op1.length || 0);
      const op2Start = op2.position;
      const op2End = op2.position + (op2.length || 0);
      
      const overlapStart = Math.max(op1Start, op2Start);
      const overlapEnd = Math.min(op1End, op2End);
      const overlapLength = Math.max(0, overlapEnd - overlapStart);
      
      const newOp1 = new DocumentOperation(
        op1.type,
        op1.position,
        op1.content,
        Math.max(0, (op1.length || 0) - overlapLength),
        op1.userId,
        op1.timestamp,
        op1.clientId
      );
      
      const newOp2 = new DocumentOperation(
        op2.type,
        op2.position,
        op2.content,
        Math.max(0, (op2.length || 0) - overlapLength),
        op2.userId,
        op2.timestamp,
        op2.clientId
      );
      
      return [newOp1.length > 0 ? newOp1 : null, newOp2.length > 0 ? newOp2 : null];
    }
  }

  static transformDeleteReplace(op1, op2) {
    if (op1.position + (op1.length || 0) <= op2.position) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position - (op1.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else if (op2.position + (op2.length || 0) <= op1.position) {
      return [new DocumentOperation(
        op1.type,
        op1.position - (op2.length || 0) + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else {
      // Overlapping operations - complex case
      const overlap = Math.min(
        op1.position + (op1.length || 0),
        op2.position + (op2.length || 0)
      ) - Math.max(op1.position, op2.position);
      
      return [new DocumentOperation(
        op1.type,
        op1.position,
        op1.content,
        Math.max(0, (op1.length || 0) - overlap),
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    }
  }

  static transformReplaceInsert(op1, op2) {
    if (op2.position <= op1.position) {
      return [new DocumentOperation(
        op1.type,
        op1.position + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else if (op2.position >= op1.position + (op1.length || 0)) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position - (op1.length || 0) + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else {
      // Insert is within replace range
      return [op1, new DocumentOperation(
        op2.type,
        op1.position + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    }
  }

  static transformReplaceDelete(op1, op2) {
    if (op2.position + (op2.length || 0) <= op1.position) {
      return [new DocumentOperation(
        op1.type,
        op1.position - (op2.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else if (op1.position + (op1.length || 0) <= op2.position) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position - (op1.length || 0) + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else {
      // Overlapping operations
      const overlap = Math.min(
        op1.position + (op1.length || 0),
        op2.position + (op2.length || 0)
      ) - Math.max(op1.position, op2.position);
      
      return [op1, new DocumentOperation(
        op2.type,
        op1.position,
        op2.content,
        Math.max(0, (op2.length || 0) - overlap),
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    }
  }

  static transformReplaceReplace(op1, op2, op1HasPriority) {
    if (op1.position + (op1.length || 0) <= op2.position) {
      return [op1, new DocumentOperation(
        op2.type,
        op2.position - (op1.length || 0) + (op1.content?.length || 0),
        op2.content,
        op2.length,
        op2.userId,
        op2.timestamp,
        op2.clientId
      )];
    } else if (op2.position + (op2.length || 0) <= op1.position) {
      return [new DocumentOperation(
        op1.type,
        op1.position - (op2.length || 0) + (op2.content?.length || 0),
        op1.content,
        op1.length,
        op1.userId,
        op1.timestamp,
        op1.clientId
      ), op2];
    } else {
      // Overlapping replaces - use priority
      if (op1HasPriority) {
        return [op1, null]; // op2 is discarded
      } else {
        return [null, op2]; // op1 is discarded
      }
    }
  }

  /**
   * Transform an operation against a sequence of operations
   * @param {DocumentOperation} operation - Operation to transform
   * @param {Array} operations - Array of operations to transform against
   * @returns {DocumentOperation} - Transformed operation
   */
  static transformAgainstOperations(operation, operations) {
    let transformedOp = operation.clone();
    
    for (const op of operations) {
      if (op.timestamp < transformedOp.timestamp || 
          (op.timestamp === transformedOp.timestamp && op.userId < transformedOp.userId)) {
        const [newOp] = EnhancedOTService.transform(transformedOp, op, false);
        if (newOp) {
          transformedOp = newOp;
        } else {
          return null; // Operation was absorbed/cancelled
        }
      }
    }
    
    return transformedOp;
  }

  /**
   * Apply operation to document content
   * @param {string} content - Current document content
   * @param {DocumentOperation} operation - Operation to apply
   * @returns {string} - Updated content
   */
  static applyOperation(content, operation) {
    if (!operation || operation.applied) {
      return content;
    }

    switch (operation.type) {
      case 'insert':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position);
               
      case 'delete':
        return content.slice(0, operation.position) + 
               content.slice(operation.position + (operation.length || 0));
               
      case 'replace':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position + (operation.length || 0));
               
      case 'retain':
        return content; // No change
        
      default:
        console.warn('Unknown operation type:', operation.type);
        return content;
    }
  }

  /**
   * Create a debounced operation from multiple small operations
   * @param {Array} operations - Array of operations to merge
   * @returns {DocumentOperation} - Merged operation
   */
  static mergeOperations(operations) {
    if (operations.length === 0) return null;
    if (operations.length === 1) return operations[0];

    // Sort by position and timestamp
    const sortedOps = operations.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.timestamp - b.timestamp;
    });

    // Simple merge for consecutive operations of the same type
    const merged = [];
    let current = sortedOps[0].clone();

    for (let i = 1; i < sortedOps.length; i++) {
      const op = sortedOps[i];
      
      if (current.type === op.type && 
          current.type === 'insert' && 
          current.position + (current.content?.length || 0) === op.position &&
          current.userId === op.userId) {
        // Merge consecutive inserts
        current.content = (current.content || '') + (op.content || '');
      } else if (current.type === op.type && 
                 current.type === 'delete' && 
                 current.position === op.position &&
                 current.userId === op.userId) {
        // Merge consecutive deletes at same position
        current.length = (current.length || 0) + (op.length || 0);
      } else {
        merged.push(current);
        current = op.clone();
      }
    }
    merged.push(current);

    return merged.length === 1 ? merged[0] : merged;
  }
}

module.exports = { EnhancedOTService, DocumentOperation };
