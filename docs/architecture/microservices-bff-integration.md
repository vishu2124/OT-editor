# Microservices and BFF Layer Integration

## Integration Architecture Overview

The BFF (Backend for Frontend) layer acts as the single entry point for the React frontend, orchestrating requests across multiple microservices while providing a unified API interface.

## Service Communication Patterns

### 1. Synchronous Communication (HTTP/REST)
- **BFF ↔ Microservices**: RESTful APIs with JSON payloads
- **Service-to-Service**: Direct HTTP calls for simple data retrieval
- **Authentication**: JWT tokens passed in Authorization headers

### 2. Asynchronous Communication (Event-Driven)
- **Event Bus**: Redis Pub/Sub or Apache Kafka for decoupled communication
- **Domain Events**: User created, document updated, comment added
- **Event Sourcing**: Audit trails and eventual consistency

### 3. Real-time Communication (WebSocket)
- **BFF ↔ Frontend**: WebSocket connections for live updates
- **Microservices → BFF**: Event notifications for real-time features

## BFF Layer Responsibilities

### API Gateway Functions
- **Request Routing**: Route requests to appropriate microservices
- **Authentication**: Validate JWT tokens and extract user context
- **Authorization**: Check permissions before forwarding requests
- **Rate Limiting**: Prevent abuse and ensure fair usage
- **Request/Response Transformation**: Adapt microservice responses for frontend needs
- **Caching**: Cache frequently accessed data (Redis)
- **Circuit Breaker**: Handle service failures gracefully

### Orchestration Patterns
- **Aggregation**: Combine data from multiple services
- **Composition**: Build complex responses from simple service calls
- **Choreography**: Coordinate multi-step workflows
- **Saga Pattern**: Manage distributed transactions

## Microservice Integration Details

### User Service Integration
```typescript
// BFF API Endpoints
GET /api/users/profile
POST /api/users/roles
PUT /api/users/{id}/permissions

// Service Communication
BFF → User Service: GET /users/profile (with JWT)
User Service → PostgreSQL: Query user data
User Service → BFF: User profile + roles
BFF → Frontend: Formatted user data
```

### Document Service Integration
```typescript
// BFF API Endpoints
GET /api/spaces
POST /api/spaces/{id}/pages
PUT /api/pages/{id}
GET /api/pages/{id}/versions

// Service Communication
BFF → Document Service: CRUD operations
Document Service → PostgreSQL: Data persistence
Document Service → Search Service: Index updates (async)
Document Service → BFF: Document data
BFF → Frontend: Formatted document response
```

### Collaboration Service Integration
```typescript
// BFF WebSocket Endpoints
WS /api/collaboration/{pageId}
WS /api/presence/{pageId}

// Real-time Communication
Frontend → BFF (WebSocket): Join collaboration room
BFF → Collaboration Service: Register user presence
Collaboration Service → Redis: Store presence data
Collaboration Service → BFF (WebSocket): Broadcast to other users
BFF → Frontend (WebSocket): Real-time updates
```

### Search Service Integration
```typescript
// BFF API Endpoints
GET /api/search?q={query}&filters={filters}

// Service Communication
BFF → Search Service: Search query
Search Service → Elasticsearch: Full-text search
Search Service → Document Service: Get additional metadata
Search Service → BFF: Combined search results
BFF → Frontend: Formatted search response
```

### Notification Service Integration
```typescript
// BFF API Endpoints
GET /api/notifications
PUT /api/notifications/{id}/read
POST /api/notifications/preferences

// Event-Driven Communication
Document Service → Event Bus: Document updated event
Notification Service ← Event Bus: Process notification rules
Notification Service → Email Service: Send email notifications
Notification Service → BFF (WebSocket): Push in-app notifications
BFF → Frontend (WebSocket): Real-time notification updates
```

## Service Discovery and Configuration

### Service Registry
- **Consul/Etcd**: Service registration and health checks
- **Load Balancing**: Round-robin, least connections, health-based
- **Circuit Breaker**: Hystrix or similar for fault tolerance

### Configuration Management
- **Environment Variables**: Service-specific configurations
- **Config Server**: Centralized configuration management
- **Secrets Management**: Vault or similar for sensitive data

## Data Consistency Patterns

### Eventual Consistency
- **Event Sourcing**: Store events instead of state
- **CQRS**: Separate read and write models
- **Saga Pattern**: Manage distributed transactions

### Strong Consistency (When Needed)
- **Distributed Locks**: Redis-based locking for critical sections
- **Two-Phase Commit**: For ACID transactions across services
- **Compensating Actions**: Rollback mechanisms for failed operations

## Error Handling and Resilience

### Circuit Breaker Pattern
```typescript
// BFF Circuit Breaker Implementation
class ServiceCircuitBreaker {
  async callService(serviceName: string, operation: Function) {
    if (this.isCircuitOpen(serviceName)) {
      throw new ServiceUnavailableError(serviceName);
    }
    
    try {
      const result = await operation();
      this.recordSuccess(serviceName);
      return result;
    } catch (error) {
      this.recordFailure(serviceName);
      throw error;
    }
  }
}
```

### Retry Policies
- **Exponential Backoff**: Increasing delays between retries
- **Jitter**: Random variation to prevent thundering herd
- **Max Retries**: Prevent infinite retry loops

### Fallback Strategies
- **Cached Data**: Return stale data when services are down
- **Default Responses**: Provide sensible defaults
- **Graceful Degradation**: Disable non-critical features

## Monitoring and Observability

### Distributed Tracing
- **OpenTelemetry**: End-to-end request tracing
- **Correlation IDs**: Track requests across services
- **Span Context**: Propagate trace information

### Metrics and Logging
- **Prometheus**: Service metrics collection
- **Grafana**: Metrics visualization and alerting
- **ELK Stack**: Centralized logging (Elasticsearch, Logstash, Kibana)

### Health Checks
```typescript
// Service Health Check Endpoint
GET /health
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "elasticsearch": "healthy"
  }
}
```

## Security Integration

### Authentication Flow
1. **Frontend** → **BFF**: Login request with credentials
2. **BFF** → **User Service**: Validate credentials
3. **User Service** → **BFF**: User data + JWT token
4. **BFF** → **Frontend**: JWT token for subsequent requests

### Authorization Middleware
```typescript
// BFF Authorization Middleware
async function authorizeRequest(req: Request, res: Response, next: NextFunction) {
  const token = extractJWT(req);
  const user = await validateToken(token);
  const permissions = await getUserPermissions(user.id, req.path);
  
  if (!hasRequiredPermissions(permissions, req.method)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  req.user = user;
  next();
}
```

### Service-to-Service Security
- **mTLS**: Mutual TLS for service communication
- **API Keys**: Service-specific authentication
- **Network Policies**: Kubernetes network segmentation

## Deployment and Scaling

### Container Orchestration
- **Kubernetes**: Container orchestration and service mesh
- **Istio**: Service mesh for traffic management
- **Helm**: Package management for Kubernetes

### Auto-scaling
- **Horizontal Pod Autoscaler**: Scale based on CPU/memory usage
- **Custom Metrics**: Scale based on business metrics (requests/sec)
- **Load Testing**: Validate scaling behavior under load

### Blue-Green Deployment
- **Zero Downtime**: Deploy new versions without service interruption
- **Rollback Strategy**: Quick rollback to previous version
- **Feature Flags**: Gradual feature rollout
