# Real-time Collaboration on AWS

## Overview

This document provides detailed implementation guidance for real-time collaborative editing features on AWS, addressing the unique challenges of multi-user document editing with conflict resolution.

## Real-time Collaboration Challenges

### Technical Challenges
1. **Concurrent Editing**: Multiple users editing the same document simultaneously
2. **Conflict Resolution**: Handling conflicting changes without data loss
3. **Connection Management**: Maintaining WebSocket connections across users
4. **State Synchronization**: Keeping all clients in sync with document state
5. **Scalability**: Supporting thousands of concurrent users
6. **Latency**: Minimizing delay for real-time updates

### AWS-Specific Considerations
1. **Stateless Services**: Lambda functions are stateless by design
2. **Connection Limits**: API Gateway WebSocket has connection limits
3. **Cold Starts**: Lambda cold starts can affect real-time performance
4. **Data Consistency**: Ensuring consistency across distributed services

## Architecture Patterns

### Pattern 1: EKS with Persistent WebSocket Connections

#### Architecture Overview
```
[Frontend] ←→ [ALB] ←→ [EKS WebSocket Service] ←→ [Redis] ←→ [RDS]
                    ↓
              [Collaboration Service]
                    ↓
              [Document Service]
```

#### Implementation Details

##### WebSocket Service in EKS
```typescript
// WebSocket Service Implementation
import WebSocket from 'ws';
import Redis from 'ioredis';
import { CRDTManager } from './crdt-manager';

class CollaborationWebSocketService {
  private redis: Redis;
  private crdtManager: CRDTManager;
  private connections: Map<string, WebSocket> = new Map();
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    
    this.crdtManager = new CRDTManager(this.redis);
  }
  
  async handleConnection(ws: WebSocket, pageId: string, userId: string) {
    const connectionId = `${pageId}:${userId}`;
    
    // Store connection
    this.connections.set(connectionId, ws);
    
    // Update presence
    await this.updatePresence(pageId, userId, 'online');
    
    // Send current document state
    const documentState = await this.crdtManager.getDocumentState(pageId);
    ws.send(JSON.stringify({
      type: 'document_state',
      data: documentState
    }));
    
    // Broadcast presence update
    await this.broadcastPresence(pageId, userId, 'joined');
    
    // Handle messages
    ws.on('message', async (data) => {
      await this.handleMessage(pageId, userId, JSON.parse(data.toString()));
    });
    
    // Handle disconnect
    ws.on('close', async () => {
      await this.handleDisconnect(pageId, userId);
    });
  }
  
  async handleMessage(pageId: string, userId: string, message: any) {
    switch (message.type) {
      case 'operation':
        await this.handleOperation(pageId, userId, message.operation);
        break;
      case 'cursor_update':
        await this.handleCursorUpdate(pageId, userId, message.cursor);
        break;
      case 'selection_update':
        await this.handleSelectionUpdate(pageId, userId, message.selection);
        break;
    }
  }
  
  async handleOperation(pageId: string, userId: string, operation: CRDTOperation) {
    // Apply operation to CRDT
    const transformedOperation = await this.crdtManager.applyOperation(
      pageId, 
      operation, 
      userId
    );
    
    // Store operation for persistence
    await this.redis.lpush(
      `operations:${pageId}`, 
      JSON.stringify({
        ...transformedOperation,
        userId,
        timestamp: Date.now()
      })
    );
    
    // Broadcast to other users
    await this.broadcastOperation(pageId, transformedOperation, userId);
  }
  
  async broadcastOperation(pageId: string, operation: CRDTOperation, excludeUserId: string) {
    const presenceKey = `presence:${pageId}`;
    const onlineUsers = await this.redis.hkeys(presenceKey);
    
    for (const userId of onlineUsers) {
      if (userId !== excludeUserId) {
        const connectionId = `${pageId}:${userId}`;
        const ws = this.connections.get(connectionId);
        
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'operation',
            operation,
            userId: excludeUserId
          }));
        }
      }
    }
  }
  
  async updatePresence(pageId: string, userId: string, status: string) {
    const presenceKey = `presence:${pageId}`;
    const userPresenceKey = `user_presence:${pageId}:${userId}`;
    
    if (status === 'online') {
      await this.redis.hset(presenceKey, userId, Date.now());
      await this.redis.setex(userPresenceKey, 300, JSON.stringify({
        userId,
        status: 'online',
        lastSeen: Date.now()
      }));
    } else {
      await this.redis.hdel(presenceKey, userId);
      await this.redis.del(userPresenceKey);
    }
  }
}
```

##### CRDT Manager Implementation
```typescript
// CRDT Manager for Conflict-free Replicated Data Types
import * as Y from 'yjs';
import Redis from 'ioredis';

interface CRDTOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  userId: string;
}

class CRDTManager {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async applyOperation(
    pageId: string, 
    operation: CRDTOperation, 
    userId: string
  ): Promise<CRDTOperation> {
    const docKey = `document:${pageId}`;
    const lockKey = `lock:${pageId}`;
    
    // Acquire distributed lock
    const lock = await this.acquireLock(lockKey, 5000);
    if (!lock) {
      throw new Error('Failed to acquire document lock');
    }
    
    try {
      // Get current document state
      const currentState = await this.redis.get(docKey);
      const doc = new Y.Doc();
      
      if (currentState) {
        Y.applyUpdate(doc, Buffer.from(currentState, 'base64'));
      }
      
      // Apply operation
      const yText = doc.getText('content');
      const transformedOperation = this.transformOperation(operation, yText);
      
      // Apply transformed operation
      if (transformedOperation.type === 'insert') {
        yText.insert(transformedOperation.position, transformedOperation.content);
      } else if (transformedOperation.type === 'delete') {
        yText.delete(transformedOperation.position, transformedOperation.length);
      }
      
      // Store updated state
      const update = Y.encodeStateAsUpdate(doc);
      await this.redis.setex(docKey, 86400, Buffer.from(update).toString('base64'));
      
      // Store operation for audit
      await this.redis.lpush(
        `operations:${pageId}`, 
        JSON.stringify({
          ...transformedOperation,
          userId,
          timestamp: Date.now()
        })
      );
      
      return transformedOperation;
    } finally {
      // Release lock
      await this.releaseLock(lockKey, lock);
    }
  }
  
  private transformOperation(operation: CRDTOperation, yText: Y.Text): CRDTOperation {
    // Implement operation transformation based on Yjs CRDT
    // This ensures operations are applied in the correct order
    // and conflicts are resolved automatically
    
    const currentLength = yText.length;
    let transformedPosition = operation.position;
    
    // Adjust position based on concurrent operations
    if (operation.type === 'insert') {
      // Find the correct insertion point
      transformedPosition = Math.min(operation.position, currentLength);
    } else if (operation.type === 'delete') {
      // Ensure deletion doesn't exceed document length
      const deleteLength = Math.min(operation.length, currentLength - operation.position);
      return {
        ...operation,
        position: transformedPosition,
        length: deleteLength
      };
    }
    
    return {
      ...operation,
      position: transformedPosition
    };
  }
  
  async getDocumentState(pageId: string): Promise<string> {
    const docKey = `document:${pageId}`;
    const currentState = await this.redis.get(docKey);
    
    if (!currentState) {
      return '';
    }
    
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Buffer.from(currentState, 'base64'));
    
    return doc.getText('content').toString();
  }
  
  private async acquireLock(key: string, ttl: number): Promise<string | null> {
    const lockValue = Date.now().toString();
    const result = await this.redis.set(key, lockValue, 'PX', ttl, 'NX');
    return result === 'OK' ? lockValue : null;
  }
  
  private async releaseLock(key: string, lockValue: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, key, lockValue);
  }
}
```

### Pattern 2: Lambda with API Gateway WebSocket

#### Architecture Overview
```
[Frontend] ←→ [API Gateway WebSocket] ←→ [Lambda Functions] ←→ [DynamoDB]
                    ↓
              [SQS for async processing]
                    ↓
              [Lambda for broadcasting]
```

#### Implementation Details

##### WebSocket Lambda Handlers
```typescript
// WebSocket Connection Handler
import { APIGatewayWebSocketEvent, APIGatewayWebSocketResult } from 'aws-lambda';
import { DynamoDB, SQS } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const sqs = new SQS();

export const connect = async (
  event: APIGatewayWebSocketEvent
): Promise<APIGatewayWebSocketResult> => {
  const { connectionId } = event.requestContext;
  const { pageId, userId } = event.queryStringParameters || {};
  
  if (!pageId || !userId) {
    return { statusCode: 400, body: 'Missing pageId or userId' };
  }
  
  try {
    // Store connection
    await dynamodb.put({
      TableName: 'websocket-connections',
      Item: {
        connectionId,
        pageId,
        userId,
        connectedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      }
    }).promise();
    
    // Update presence
    await dynamodb.put({
      TableName: 'user-presence',
      Item: {
        pageId,
        userId,
        status: 'online',
        lastSeen: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 300 // 5 minutes
      }
    }).promise();
    
    // Send current document state
    const documentState = await getDocumentState(pageId);
    await sendMessage(connectionId, {
      type: 'document_state',
      data: documentState
    });
    
    // Broadcast presence update
    await broadcastPresenceUpdate(pageId, userId, 'joined');
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Connection error:', error);
    return { statusCode: 500, body: 'Connection failed' };
  }
};

export const disconnect = async (
  event: APIGatewayWebSocketEvent
): Promise<APIGatewayWebSocketResult> => {
  const { connectionId } = event.requestContext;
  
  try {
    // Get connection info
    const connection = await dynamodb.get({
      TableName: 'websocket-connections',
      Key: { connectionId }
    }).promise();
    
    if (connection.Item) {
      const { pageId, userId } = connection.Item;
      
      // Remove connection
      await dynamodb.delete({
        TableName: 'websocket-connections',
        Key: { connectionId }
      }).promise();
      
      // Update presence
      await dynamodb.put({
        TableName: 'user-presence',
        Item: {
          pageId,
          userId,
          status: 'offline',
          lastSeen: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + 300
        }
      }).promise();
      
      // Broadcast presence update
      await broadcastPresenceUpdate(pageId, userId, 'left');
    }
    
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Disconnection error:', error);
    return { statusCode: 500, body: 'Disconnection failed' };
  }
};

export const message = async (
  event: APIGatewayWebSocketEvent
): Promise<APIGatewayWebSocketResult> => {
  const { connectionId } = event.requestContext;
  const message = JSON.parse(event.body || '{}');
  
  try {
    // Get connection info
    const connection = await dynamodb.get({
      TableName: 'websocket-connections',
      Key: { connectionId }
    }).promise();
    
    if (!connection.Item) {
      return { statusCode: 400, body: 'Connection not found' };
    }
    
    const { pageId, userId } = connection.Item;
    
    switch (message.type) {
      case 'operation':
        await handleOperation(pageId, userId, message.operation);
        break;
      case 'cursor_update':
        await handleCursorUpdate(pageId, userId, message.cursor);
        break;
      case 'presence_update':
        await handlePresenceUpdate(pageId, userId, message.presence);
        break;
    }
    
    return { statusCode: 200, body: 'Message processed' };
  } catch (error) {
    console.error('Message processing error:', error);
    return { statusCode: 500, body: 'Message processing failed' };
  }
};

async function handleOperation(pageId: string, userId: string, operation: any) {
  // Store operation in DynamoDB
  await dynamodb.put({
    TableName: 'crdt-operations',
    Item: {
      pageId,
      operationId: `${Date.now()}-${userId}`,
      operation,
      userId,
      timestamp: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    }
  }).promise();
  
  // Send to SQS for async processing
  await sqs.sendMessage({
    QueueUrl: process.env.OPERATION_QUEUE_URL,
    MessageBody: JSON.stringify({
      pageId,
      userId,
      operation,
      timestamp: Date.now()
    })
  }).promise();
}

async function broadcastPresenceUpdate(pageId: string, userId: string, action: string) {
  // Get all connections for this page
  const connections = await dynamodb.query({
    TableName: 'websocket-connections',
    IndexName: 'pageId-index',
    KeyConditionExpression: 'pageId = :pageId',
    ExpressionAttributeValues: {
      ':pageId': pageId
    }
  }).promise();
  
  // Send presence update to all connections
  for (const connection of connections.Items || []) {
    if (connection.userId !== userId) {
      await sendMessage(connection.connectionId, {
        type: 'presence_update',
        userId,
        action,
        timestamp: Date.now()
      });
    }
  }
}

async function sendMessage(connectionId: string, message: any) {
  const { ApiGatewayManagementApi } = require('aws-sdk');
  const apiGateway = new ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_ENDPOINT
  });
  
  try {
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }).promise();
  } catch (error) {
    if (error.statusCode === 410) {
      // Connection is stale, remove it
      await dynamodb.delete({
        TableName: 'websocket-connections',
        Key: { connectionId }
      }).promise();
    }
    throw error;
  }
}
```

##### SQS-based Operation Processing
```typescript
// SQS Lambda Handler for Operation Processing
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { DynamoDB, ApiGatewayManagementApi } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT
});

export const processOperations: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { pageId, userId, operation, timestamp } = JSON.parse(record.body);
    
    try {
      // Apply operation to document state
      const transformedOperation = await applyCRDTOperation(pageId, operation);
      
      // Broadcast to all connected users
      await broadcastOperation(pageId, transformedOperation, userId);
      
      // Update document in database
      await updateDocumentState(pageId, transformedOperation);
      
    } catch (error) {
      console.error('Operation processing error:', error);
      // Dead letter queue handling would go here
    }
  }
};

async function applyCRDTOperation(pageId: string, operation: any) {
  // Get current document state
  const document = await dynamodb.get({
    TableName: 'documents',
    Key: { pageId }
  }).promise();
  
  // Apply CRDT transformation
  const transformedOperation = transformOperation(operation, document.Item?.content || '');
  
  return transformedOperation;
}

async function broadcastOperation(pageId: string, operation: any, excludeUserId: string) {
  // Get all connections for this page
  const connections = await dynamodb.query({
    TableName: 'websocket-connections',
    IndexName: 'pageId-index',
    KeyConditionExpression: 'pageId = :pageId',
    ExpressionAttributeValues: {
      ':pageId': pageId
    }
  }).promise();
  
  // Send operation to all connected users except the sender
  for (const connection of connections.Items || []) {
    if (connection.userId !== excludeUserId) {
      try {
        await apiGateway.postToConnection({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify({
            type: 'operation',
            operation,
            userId: excludeUserId,
            timestamp: Date.now()
          })
        }).promise();
      } catch (error) {
        if (error.statusCode === 410) {
          // Connection is stale, remove it
          await dynamodb.delete({
            TableName: 'websocket-connections',
            Key: { connectionId: connection.connectionId }
          }).promise();
        }
      }
    }
  }
}
```

## Performance Optimization

### Connection Pooling and Management
```typescript
// Connection Pool Manager for EKS
class ConnectionPoolManager {
  private pools: Map<string, WebSocket[]> = new Map();
  private maxConnectionsPerPage = 100;
  
  async addConnection(pageId: string, ws: WebSocket) {
    if (!this.pools.has(pageId)) {
      this.pools.set(pageId, []);
    }
    
    const pool = this.pools.get(pageId)!;
    
    if (pool.length >= this.maxConnectionsPerPage) {
      // Implement connection limiting strategy
      await this.handleConnectionLimit(pageId, ws);
      return;
    }
    
    pool.push(ws);
    
    // Set up cleanup on disconnect
    ws.on('close', () => {
      this.removeConnection(pageId, ws);
    });
  }
  
  private async handleConnectionLimit(pageId: string, ws: WebSocket) {
    // Strategy 1: Reject new connections
    ws.close(1013, 'Page connection limit reached');
    
    // Strategy 2: Disconnect oldest inactive connection
    // const oldestConnection = this.getOldestInactiveConnection(pageId);
    // if (oldestConnection) {
    //   oldestConnection.close(1000, 'Replaced by new connection');
    //   this.addConnection(pageId, ws);
    // }
  }
}
```

### Caching Strategy
```typescript
// Redis-based Caching for Real-time Data
class RealTimeCache {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async cacheDocumentState(pageId: string, state: string) {
    await this.redis.setex(`doc:${pageId}`, 3600, state); // 1 hour cache
  }
  
  async getCachedDocumentState(pageId: string): Promise<string | null> {
    return await this.redis.get(`doc:${pageId}`);
  }
  
  async cacheUserPresence(pageId: string, userId: string, presence: any) {
    await this.redis.setex(
      `presence:${pageId}:${userId}`, 
      300, 
      JSON.stringify(presence)
    ); // 5 minutes cache
  }
  
  async getCachedPresence(pageId: string): Promise<any[]> {
    const keys = await this.redis.keys(`presence:${pageId}:*`);
    const presences = await this.redis.mget(keys);
    return presences.map(p => JSON.parse(p)).filter(Boolean);
  }
}
```

## Monitoring and Observability

### Real-time Metrics
```typescript
// CloudWatch Metrics for Collaboration
class CollaborationMetrics {
  private cloudwatch: CloudWatch;
  
  constructor() {
    this.cloudwatch = new CloudWatch();
  }
  
  async recordWebSocketConnection(pageId: string, userId: string) {
    await this.cloudwatch.putMetricData({
      Namespace: 'ConfluenceClone/Collaboration',
      MetricData: [
        {
          MetricName: 'WebSocketConnections',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'PageId', Value: pageId }
          ]
        }
      ]
    }).promise();
  }
  
  async recordOperation(pageId: string, operationType: string) {
    await this.cloudwatch.putMetricData({
      Namespace: 'ConfluenceClone/Collaboration',
      MetricData: [
        {
          MetricName: 'OperationsPerSecond',
          Value: 1,
          Unit: 'Count/Second',
          Dimensions: [
            { Name: 'PageId', Value: pageId },
            { Name: 'OperationType', Value: operationType }
          ]
        }
      ]
    }).promise();
  }
  
  async recordLatency(pageId: string, latency: number) {
    await this.cloudwatch.putMetricData({
      Namespace: 'ConfluenceClone/Collaboration',
      MetricData: [
        {
          MetricName: 'OperationLatency',
          Value: latency,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'PageId', Value: pageId }
          ]
        }
      ]
    }).promise();
  }
}
```

### Health Checks
```typescript
// Health Check for Real-time Services
class CollaborationHealthCheck {
  private redis: Redis;
  private dynamodb: DynamoDB.DocumentClient;
  
  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkRedis(),
      this.checkDynamoDB(),
      this.checkWebSocketConnections()
    ]);
    
    const results = checks.map(check => 
      check.status === 'fulfilled' ? check.value : { status: 'unhealthy', error: check.reason }
    );
    
    return {
      overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      checks: results
    };
  }
  
  private async checkRedis(): Promise<HealthCheckResult> {
    try {
      await this.redis.ping();
      return { status: 'healthy', service: 'redis' };
    } catch (error) {
      return { status: 'unhealthy', service: 'redis', error: error.message };
    }
  }
  
  private async checkDynamoDB(): Promise<HealthCheckResult> {
    try {
      await this.dynamodb.describeTable({ TableName: 'websocket-connections' }).promise();
      return { status: 'healthy', service: 'dynamodb' };
    } catch (error) {
      return { status: 'unhealthy', service: 'dynamodb', error: error.message };
    }
  }
}
```

This comprehensive guide provides the foundation for implementing real-time collaborative editing on AWS, with detailed code examples and architectural patterns for both EKS and Lambda deployment models.
