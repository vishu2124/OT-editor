# AWS Infrastructure Design

## Infrastructure Overview

This document outlines AWS infrastructure design for the Confluence-like platform, supporting both EKS (Elastic Kubernetes Service) and Lambda deployment models with real-time collaborative editing capabilities.

## Architecture Decision: EKS vs Lambda

### EKS Deployment (Recommended for Real-time Collaboration)
**Pros:**
- Persistent WebSocket connections for real-time editing
- Better control over resource allocation
- Easier stateful service management
- Lower latency for collaborative features

**Cons:**
- Higher operational complexity
- More expensive for low-traffic scenarios
- Requires Kubernetes expertise

### Lambda Deployment (Suitable for Read-heavy Workloads)
**Pros:**
- Serverless scaling and cost optimization
- Lower operational overhead
- Pay-per-request pricing model
- Built-in high availability

**Cons:**
- WebSocket limitations (API Gateway WebSocket)
- Cold start latency
- Stateless constraints for real-time features

## EKS Infrastructure Design

### Core AWS Services

#### 1. Compute & Orchestration
```yaml
# EKS Cluster Configuration
EKS Cluster:
  Name: confluence-clone-prod
  Version: 1.28
  Node Groups:
    - System Nodes: t3.medium (2 instances)
    - Application Nodes: t3.large (3-10 instances, auto-scaling)
    - Database Nodes: r5.xlarge (2 instances, for managed services)
  
  Networking:
    VPC: Custom VPC with public/private subnets
    CNI: AWS VPC CNI plugin
    Security Groups: Application-specific rules
```

#### 2. Database Services
```yaml
# RDS PostgreSQL Configuration
RDS PostgreSQL:
  Engine: PostgreSQL 14.9
  Instance Class: db.r5.xlarge
  Multi-AZ: Enabled
  Storage: 
    Type: gp3
    Size: 500 GB
    IOPS: 3000
    Throughput: 125 MB/s
  Backup:
    Retention: 7 days
    Automated: Enabled
    Point-in-time: Enabled
  
# ElastiCache Redis Configuration
ElastiCache Redis:
  Engine: Redis 7.0
  Node Type: cache.r6g.large
  Cluster Mode: Disabled (single node for simplicity)
  Multi-AZ: Enabled
  Backup: Enabled (1 day retention)
  
# OpenSearch (Elasticsearch) Configuration
OpenSearch:
  Engine: OpenSearch 2.3
  Instance Type: r6g.large.search
  Instance Count: 3 (for high availability)
  Storage: 100 GB EBS gp3 per node
  Encryption: Enabled
```

#### 3. Networking & Security
```yaml
# VPC Configuration
VPC:
  CIDR: 10.0.0.0/16
  Subnets:
    Public:
      - 10.0.1.0/24 (us-east-1a)
      - 10.0.2.0/24 (us-east-1b)
    Private:
      - 10.0.11.0/24 (us-east-1a)
      - 10.0.12.0/24 (us-east-1b)
    Database:
      - 10.0.21.0/24 (us-east-1a)
      - 10.0.22.0/24 (us-east-1b)

# Security Groups
Security Groups:
  EKS Cluster:
    - Inbound: 443 from ALB
    - Outbound: All traffic
  
  EKS Nodes:
    - Inbound: 1025-65535 from EKS Cluster
    - Outbound: All traffic
  
  RDS:
    - Inbound: 5432 from EKS Nodes
    - Outbound: None
  
  ElastiCache:
    - Inbound: 6379 from EKS Nodes
    - Outbound: None
  
  OpenSearch:
    - Inbound: 443 from EKS Nodes
    - Outbound: None
```

#### 4. Load Balancing & CDN
```yaml
# Application Load Balancer
ALB:
  Type: Application Load Balancer
  Scheme: Internet-facing
  Subnets: Public subnets
  Security Groups: ALB-specific
  Listeners:
    - Port 80: Redirect to HTTPS
    - Port 443: Forward to EKS services
  Target Groups:
    - Frontend: Port 80
    - BFF Service: Port 3000
    - WebSocket: Port 3000 (sticky sessions)

# CloudFront Distribution
CloudFront:
  Origins:
    - ALB (for API calls)
    - S3 (for static assets)
  Behaviors:
    - /api/*: ALB origin, no caching
    - /ws/*: ALB origin, no caching
    - /static/*: S3 origin, 1 year caching
    - /*: ALB origin, 1 hour caching
  SSL Certificate: ACM certificate
```

#### 5. Storage & File Management
```yaml
# S3 Buckets
S3 Buckets:
  Static Assets:
    Name: confluence-clone-static-prod
    Versioning: Enabled
    Encryption: AES-256
    Lifecycle: IA after 30 days, Glacier after 90 days
  
  File Uploads:
    Name: confluence-clone-uploads-prod
    Versioning: Enabled
    Encryption: AES-256
    Lifecycle: IA after 7 days, Glacier after 30 days
    CORS: Configured for web uploads
  
  Backups:
    Name: confluence-clone-backups-prod
    Versioning: Enabled
    Encryption: AES-256
    Lifecycle: Glacier after 1 day, Deep Archive after 1 year

# EFS (for shared file storage if needed)
EFS:
  Performance Mode: General Purpose
  Throughput Mode: Bursting
  Encryption: Enabled
  Mount Targets: Private subnets
```

### Real-time Collaboration Infrastructure

#### WebSocket Support in EKS
```yaml
# WebSocket Service Configuration
WebSocket Service:
  Type: NodePort
  Port: 3000
  Sticky Sessions: Enabled
  Health Checks:
    Path: /health
    Interval: 30s
    Timeout: 5s
    Healthy Threshold: 2
    Unhealthy Threshold: 3
  
  Auto Scaling:
    Min Replicas: 2
    Max Replicas: 10
    Target CPU: 70%
    Target Memory: 80%
  
  Resource Limits:
    CPU: 500m
    Memory: 512Mi
    Requests:
      CPU: 250m
      Memory: 256Mi
```

#### Redis for Real-time State Management
```yaml
# ElastiCache Redis Configuration for Collaboration
ElastiCache Redis:
  Cluster Mode: Enabled
  Node Type: cache.r6g.large
  Num Cache Nodes: 3
  Parameter Group: default.redis7
  Security Groups: Redis-specific
  Subnet Group: Database subnets
  
  Use Cases:
    - WebSocket session management
    - Real-time presence tracking
    - CRDT operation queuing
    - Rate limiting
    - Caching frequently accessed data
```

## Lambda Infrastructure Design

### Serverless Architecture

#### 1. API Gateway Configuration
```yaml
# API Gateway Setup
API Gateway:
  Type: REST API
  Endpoints:
    - /auth/*: Lambda functions
    - /api/users/*: Lambda functions
    - /api/spaces/*: Lambda functions
    - /api/pages/*: Lambda functions
    - /api/search/*: Lambda functions
  
  WebSocket API:
    Route Selection: $request.body.action
    Routes:
      - $connect: Connect handler
      - $disconnect: Disconnect handler
      - $default: Message handler
      - join: Join room handler
      - operation: CRDT operation handler
      - presence: Presence update handler
  
  Throttling:
    Burst Limit: 5000
    Rate Limit: 2000
```

#### 2. Lambda Functions
```yaml
# Lambda Function Configuration
Lambda Functions:
  Auth Service:
    Runtime: Node.js 18.x
    Memory: 512 MB
    Timeout: 30 seconds
    Environment Variables:
      - DATABASE_URL
      - JWT_SECRET
      - REDIS_URL
  
  User Service:
    Runtime: Node.js 18.x
    Memory: 256 MB
    Timeout: 15 seconds
    VPC Configuration: Database subnets
  
  Document Service:
    Runtime: Node.js 18.x
    Memory: 512 MB
    Timeout: 30 seconds
    VPC Configuration: Database subnets
  
  Collaboration Service:
    Runtime: Node.js 18.x
    Memory: 1024 MB
    Timeout: 60 seconds
    VPC Configuration: Database subnets
  
  Search Service:
    Runtime: Node.js 18.x
    Memory: 512 MB
    Timeout: 30 seconds
    VPC Configuration: Database subnets
  
  WebSocket Handlers:
    Runtime: Node.js 18.x
    Memory: 256 MB
    Timeout: 30 seconds
    VPC Configuration: Database subnets
```

#### 3. DynamoDB for Real-time State
```yaml
# DynamoDB Tables for Collaboration
DynamoDB Tables:
  Collaboration Sessions:
    Table Name: collaboration-sessions
    Partition Key: pageId (String)
    Sort Key: userId (String)
    TTL: lastSeen (Number)
    Global Secondary Indexes:
      - userId-index: userId (String)
    Streams: Enabled (for cleanup)
  
  CRDT Operations:
    Table Name: crdt-operations
    Partition Key: pageId (String)
    Sort Key: timestamp (Number)
    TTL: createdAt (Number)
    Streams: Enabled (for processing)
  
  User Presence:
    Table Name: user-presence
    Partition Key: pageId (String)
    Sort Key: userId (String)
    TTL: lastSeen (Number)
    Streams: Enabled (for cleanup)
```

## Real-time Collaboration Considerations

### WebSocket Connection Management

#### EKS Approach
```typescript
// WebSocket Service in EKS
class CollaborationService {
  private redis: Redis;
  private wsClients: Map<string, WebSocket>;
  
  async handleConnection(ws: WebSocket, pageId: string, userId: string) {
    // Store connection in memory
    this.wsClients.set(`${pageId}:${userId}`, ws);
    
    // Update presence in Redis
    await this.redis.hset(`presence:${pageId}`, userId, Date.now());
    
    // Broadcast presence to other users
    await this.broadcastPresence(pageId, userId, 'joined');
  }
  
  async handleOperation(pageId: string, operation: CRDTOperation) {
    // Store operation in Redis
    await this.redis.lpush(`operations:${pageId}`, JSON.stringify(operation));
    
    // Broadcast to other connected users
    await this.broadcastOperation(pageId, operation);
  }
}
```

#### Lambda Approach
```typescript
// WebSocket Lambda Handler
export const handler = async (event: APIGatewayWebSocketEvent) => {
  const { routeKey, connectionId, body } = event;
  
  switch (routeKey) {
    case '$connect':
      return await handleConnect(connectionId, event.queryStringParameters);
    
    case '$disconnect':
      return await handleDisconnect(connectionId);
    
    case 'operation':
      const operation = JSON.parse(body);
      return await handleOperation(connectionId, operation);
    
    case 'presence':
      const presence = JSON.parse(body);
      return await handlePresence(connectionId, presence);
  }
};

async function handleOperation(connectionId: string, operation: CRDTOperation) {
  // Store in DynamoDB
  await dynamodb.put({
    TableName: 'crdt-operations',
    Item: {
      pageId: operation.pageId,
      timestamp: Date.now(),
      operation: operation,
      connectionId: connectionId
    }
  }).promise();
  
  // Broadcast to other connections
  await broadcastToPage(operation.pageId, operation, connectionId);
}
```

### CRDT Implementation for AWS

#### Redis-based CRDT (EKS)
```typescript
// CRDT Operations with Redis
class CRDTManager {
  private redis: Redis;
  
  async applyOperation(pageId: string, operation: CRDTOperation) {
    const key = `crdt:${pageId}`;
    
    // Get current state
    const currentState = await this.redis.get(key);
    const crdt = new Yjs.Doc();
    
    if (currentState) {
      Yjs.applyUpdate(crdt, Buffer.from(currentState, 'base64'));
    }
    
    // Apply new operation
    Yjs.applyUpdate(crdt, operation.data);
    
    // Store updated state
    const newState = Yjs.encodeStateAsUpdate(crdt);
    await this.redis.set(key, Buffer.from(newState).toString('base64'));
    
    // Set TTL for cleanup
    await this.redis.expire(key, 86400); // 24 hours
  }
}
```

#### DynamoDB-based CRDT (Lambda)
```typescript
// CRDT Operations with DynamoDB
class CRDTManager {
  async applyOperation(pageId: string, operation: CRDTOperation) {
    // Store operation
    await dynamodb.put({
      TableName: 'crdt-operations',
      Item: {
        pageId: pageId,
        timestamp: Date.now(),
        operation: operation,
        ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hours
      }
    }).promise();
    
    // Get recent operations for this page
    const operations = await dynamodb.query({
      TableName: 'crdt-operations',
      KeyConditionExpression: 'pageId = :pageId',
      ExpressionAttributeValues: {
        ':pageId': pageId
      },
      ScanIndexForward: false,
      Limit: 100
    }).promise();
    
    // Apply operations to reconstruct state
    const crdt = new Yjs.Doc();
    operations.Items.reverse().forEach(item => {
      Yjs.applyUpdate(crdt, item.operation.data);
    });
    
    return Yjs.encodeStateAsUpdate(crdt);
  }
}
```

## Cost Optimization Strategies

### EKS Cost Optimization
```yaml
# Cost Optimization for EKS
Cost Optimization:
  Node Groups:
    - Use Spot Instances for non-critical workloads
    - Implement Cluster Autoscaler
    - Use Graviton instances (ARM-based) for better price/performance
  
  Resource Management:
    - Set appropriate resource requests and limits
    - Use Horizontal Pod Autoscaler
    - Implement Vertical Pod Autoscaler
  
  Storage:
    - Use gp3 EBS volumes instead of gp2
    - Implement lifecycle policies for S3
    - Use S3 Intelligent Tiering
```

### Lambda Cost Optimization
```yaml
# Cost Optimization for Lambda
Cost Optimization:
  Function Configuration:
    - Right-size memory allocation
    - Use Provisioned Concurrency for critical functions
    - Implement connection pooling for database connections
  
  API Gateway:
    - Use caching for frequently accessed data
    - Implement request/response compression
    - Use API Gateway throttling
  
  DynamoDB:
    - Use On-Demand billing for unpredictable workloads
    - Implement auto-scaling for provisioned capacity
    - Use DynamoDB Accelerator (DAX) for caching
```

## Monitoring and Observability

### CloudWatch Configuration
```yaml
# CloudWatch Monitoring
CloudWatch:
  Log Groups:
    - /aws/eks/confluence-clone/application
    - /aws/lambda/confluence-clone-auth
    - /aws/lambda/confluence-clone-user
    - /aws/lambda/confluence-clone-document
    - /aws/lambda/confluence-clone-collaboration
  
  Metrics:
    - Custom metrics for collaboration events
    - WebSocket connection counts
    - CRDT operation rates
    - User presence tracking
  
  Alarms:
    - High error rates
    - WebSocket connection failures
    - Database connection issues
    - Lambda cold start duration
```

### X-Ray Tracing
```yaml
# X-Ray Configuration
X-Ray:
  Sampling Rules:
    - Default: 1% sampling rate
    - High-traffic endpoints: 0.1% sampling rate
    - Error cases: 100% sampling rate
  
  Instrumentation:
    - Lambda functions
    - API Gateway
    - DynamoDB operations
    - RDS queries
    - ElastiCache operations
```

## Security Configuration

### IAM Roles and Policies
```yaml
# IAM Configuration
IAM Roles:
  EKS Service Role:
    - AmazonEKSClusterPolicy
    - AmazonEKSVPCResourceController
  
  EKS Node Group Role:
    - AmazonEKSWorkerNodePolicy
    - AmazonEKS_CNI_Policy
    - AmazonEC2ContainerRegistryReadOnly
  
  Lambda Execution Role:
    - AWSLambdaVPCAccessExecutionRole
    - AmazonDynamoDBFullAccess
    - AmazonElastiCacheFullAccess
    - AmazonRDSFullAccess
  
  Application Role:
    - Custom policies for specific service access
    - Least privilege principle
    - Resource-based policies
```

### Secrets Management
```yaml
# AWS Secrets Manager
Secrets Manager:
  Secrets:
    - database-credentials
    - jwt-secret
    - encryption-keys
    - oauth-client-secrets
    - smtp-credentials
  
  Rotation:
    - Automatic rotation for database credentials
    - Manual rotation for application secrets
    - Integration with Lambda for secret updates
```

## Disaster Recovery

### Backup Strategy
```yaml
# Backup Configuration
Backup Strategy:
  RDS:
    - Automated backups: 7 days retention
    - Point-in-time recovery: 35 days
    - Cross-region backup replication
  
  DynamoDB:
    - Point-in-time recovery: 35 days
    - On-demand backups for critical data
    - Cross-region replication
  
  S3:
    - Cross-region replication
    - Versioning enabled
    - Lifecycle policies for cost optimization
  
  EKS:
    - etcd backups (if using self-managed)
    - Application data backups
    - Configuration backups
```

### Multi-Region Setup
```yaml
# Multi-Region Configuration
Multi-Region:
  Primary Region: us-east-1
  Secondary Region: us-west-2
  
  Services:
    - RDS: Read replicas in secondary region
    - ElastiCache: Cross-region replication
    - S3: Cross-region replication
    - DynamoDB: Global tables
    - CloudFront: Global distribution
```

## Deployment Automation

### Infrastructure as Code
```yaml
# Terraform Configuration
Terraform:
  Providers:
    - AWS Provider
    - Kubernetes Provider
    - Helm Provider
  
  Modules:
    - VPC and Networking
    - EKS Cluster
    - RDS Database
    - ElastiCache Redis
    - S3 Buckets
    - Lambda Functions
    - API Gateway
    - CloudWatch
```

### CI/CD Pipeline
```yaml
# GitHub Actions for AWS Deployment
CI/CD Pipeline:
  Stages:
    - Build and Test
    - Security Scanning
    - Infrastructure Deployment
    - Application Deployment
    - Integration Testing
    - Production Deployment
  
  AWS Services:
    - ECR for container registry
    - CodeBuild for build processes
    - CodeDeploy for deployments
    - CodePipeline for orchestration
```

This AWS infrastructure design provides a robust, scalable, and cost-effective foundation for the Confluence-like platform, with special attention to real-time collaborative editing requirements and the flexibility to choose between EKS and Lambda deployment models based on specific needs.
