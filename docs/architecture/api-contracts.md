# API Contracts and Service Integration

## BFF API Endpoints

### Authentication & User Management
```typescript
// User Authentication
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/profile

// User Management (Admin only)
GET /api/users
POST /api/users
PUT /api/users/{id}
DELETE /api/users/{id}
PUT /api/users/{id}/role
PUT /api/users/{id}/permissions
```

### Document Management
```typescript
// Spaces
GET /api/spaces
POST /api/spaces
GET /api/spaces/{id}
PUT /api/spaces/{id}
DELETE /api/spaces/{id}

// Pages
GET /api/spaces/{spaceId}/pages
POST /api/spaces/{spaceId}/pages
GET /api/pages/{id}
PUT /api/pages/{id}
DELETE /api/pages/{id}
PUT /api/pages/{id}/archive
PUT /api/pages/{id}/publish

// Version History
GET /api/pages/{id}/versions
GET /api/pages/{id}/versions/{versionId}
POST /api/pages/{id}/versions/{versionId}/restore
```

### Collaboration
```typescript
// Real-time Collaboration (WebSocket)
WS /api/collaboration/{pageId}
WS /api/presence/{pageId}

// Comments
GET /api/pages/{id}/comments
POST /api/pages/{id}/comments
PUT /api/comments/{id}
DELETE /api/comments/{id}

// Document Locking
PUT /api/pages/{id}/lock
DELETE /api/pages/{id}/lock
```

### Search
```typescript
// Search
GET /api/search?q={query}&space={spaceId}&author={userId}&date={dateRange}
GET /api/search/suggestions?q={partialQuery}
```

### Notifications
```typescript
// Notifications
GET /api/notifications
PUT /api/notifications/{id}/read
PUT /api/notifications/preferences
```

## Microservice Internal APIs

### User Service (Port 3001)
```typescript
// Internal API (BFF → User Service)
GET /internal/users/{id}
GET /internal/users/{id}/permissions
GET /internal/users/{id}/roles
POST /internal/users
PUT /internal/users/{id}
PUT /internal/users/{id}/role
```

### Document Service (Port 3002)
```typescript
// Internal API (BFF → Document Service)
GET /internal/spaces
GET /internal/spaces/{id}
POST /internal/spaces
PUT /internal/spaces/{id}
DELETE /internal/spaces/{id}

GET /internal/pages
GET /internal/pages/{id}
POST /internal/pages
PUT /internal/pages/{id}
DELETE /internal/pages/{id}
GET /internal/pages/{id}/versions
```

### Collaboration Service (Port 3003)
```typescript
// Internal API (BFF → Collaboration Service)
POST /internal/collaboration/join
POST /internal/collaboration/leave
POST /internal/collaboration/operation
GET /internal/presence/{pageId}
```

### Search Service (Port 3004)
```typescript
// Internal API (BFF → Search Service)
GET /internal/search
POST /internal/index
DELETE /internal/index/{id}
```

### Notification Service (Port 3005)
```typescript
// Internal API (BFF → Notification Service)
GET /internal/notifications/{userId}
POST /internal/notifications
PUT /internal/notifications/{id}/read
```

## Event Contracts

### Domain Events
```typescript
// User Events
interface UserCreatedEvent {
  eventType: 'user.created';
  userId: string;
  email: string;
  role: string;
  timestamp: string;
}

// Document Events
interface DocumentUpdatedEvent {
  eventType: 'document.updated';
  documentId: string;
  spaceId: string;
  userId: string;
  version: number;
  timestamp: string;
}

interface DocumentPublishedEvent {
  eventType: 'document.published';
  documentId: string;
  spaceId: string;
  userId: string;
  timestamp: string;
}

// Collaboration Events
interface UserJoinedEvent {
  eventType: 'collaboration.user_joined';
  pageId: string;
  userId: string;
  timestamp: string;
}

interface OperationEvent {
  eventType: 'collaboration.operation';
  pageId: string;
  userId: string;
  operation: CRDTOperation;
  timestamp: string;
}

// Comment Events
interface CommentAddedEvent {
  eventType: 'comment.added';
  commentId: string;
  pageId: string;
  userId: string;
  mentionedUsers: string[];
  timestamp: string;
}
```

## Data Transfer Objects (DTOs)

### User DTOs
```typescript
interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'space_admin' | 'editor' | 'viewer';
  permissions: string[];
  createdAt: string;
  lastLoginAt?: string;
}

interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
  spaceIds?: string[];
}
```

### Document DTOs
```typescript
interface Space {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  permissions: SpacePermissions;
  createdAt: string;
  updatedAt: string;
}

interface Page {
  id: string;
  title: string;
  content: string;
  spaceId: string;
  parentId?: string;
  authorId: string;
  isDraft: boolean;
  isArchived: boolean;
  lockedBy?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface PageVersion {
  id: string;
  pageId: string;
  version: number;
  content: string;
  authorId: string;
  createdAt: string;
}
```

### Collaboration DTOs
```typescript
interface PresenceInfo {
  userId: string;
  userName: string;
  avatar?: string;
  cursorPosition?: CursorPosition;
  lastSeen: string;
}

interface CRDTOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: string;
  userId: string;
}

interface Comment {
  id: string;
  pageId: string;
  content: string;
  authorId: string;
  textRange: TextRange;
  mentionedUsers: string[];
  createdAt: string;
  updatedAt: string;
}
```

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

// Common Error Codes
enum ErrorCodes {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

## Service Health Checks

### Health Check Endpoints
```typescript
// Each microservice exposes
GET /health
{
  "status": "healthy" | "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.2.3",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy",
    "elasticsearch": "healthy"
  },
  "metrics": {
    "uptime": "2d 5h 30m",
    "memoryUsage": "45%",
    "cpuUsage": "12%"
  }
}
```

## Rate Limiting

### Rate Limit Headers
```typescript
// Response headers
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 60
```

## Caching Strategy

### Cache Headers
```typescript
// Response headers for cacheable resources
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: "Mon, 15 Jan 2024 10:30:00 GMT"
```
