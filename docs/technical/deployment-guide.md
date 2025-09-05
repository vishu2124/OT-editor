# Deployment Guide

## Deployment Overview

This guide covers the deployment of the Confluence-like platform using containerized microservices with Kubernetes orchestration.

## Infrastructure Requirements

### Minimum System Requirements
```yaml
# Production Environment
production:
  nodes: 3
  cpu_per_node: 8 cores
  memory_per_node: 32 GB
  storage_per_node: 500 GB SSD
  network: 10 Gbps

# Staging Environment
staging:
  nodes: 2
  cpu_per_node: 4 cores
  memory_per_node: 16 GB
  storage_per_node: 250 GB SSD
  network: 1 Gbps

# Development Environment
development:
  nodes: 1
  cpu_per_node: 4 cores
  memory_per_node: 8 GB
  storage_per_node: 100 GB SSD
  network: 1 Gbps
```

### Required Services
- **Kubernetes**: 1.24+ (EKS, GKE, or AKS)
- **Container Registry**: Docker Hub, ECR, or GCR
- **Database**: PostgreSQL 14+ (RDS, Cloud SQL, or self-managed)
- **Search**: Elasticsearch 8+ (Elastic Cloud or self-managed)
- **Cache**: Redis 6+ (ElastiCache, Memorystore, or self-managed)
- **Load Balancer**: AWS ALB, GCP Load Balancer, or Azure Load Balancer
- **CDN**: CloudFront, Cloud CDN, or Azure CDN

## Container Configuration

### Dockerfile Examples

#### BFF Service
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

USER node
CMD ["node", "dist/index.js"]
```

#### Microservice
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3001

USER node
CMD ["node", "dist/index.js"]
```

#### Frontend
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Kubernetes Manifests

### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: confluence-clone
  labels:
    name: confluence-clone
```

### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: confluence-clone
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/confluence"
  REDIS_URL: "redis://redis:6379"
  ELASTICSEARCH_URL: "http://elasticsearch:9200"
  JWT_SECRET: "your-jwt-secret"
  ENCRYPTION_KEY: "your-encryption-key"
```

### Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: confluence-clone
type: Opaque
data:
  DATABASE_PASSWORD: <base64-encoded-password>
  JWT_SECRET: <base64-encoded-jwt-secret>
  ENCRYPTION_KEY: <base64-encoded-encryption-key>
  SMTP_PASSWORD: <base64-encoded-smtp-password>
  OAUTH_CLIENT_SECRET: <base64-encoded-oauth-secret>
```

### BFF Service Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bff-service
  namespace: confluence-clone
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bff-service
  template:
    metadata:
      labels:
        app: bff-service
    spec:
      containers:
      - name: bff-service
        image: confluence-clone/bff:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: bff-service
  namespace: confluence-clone
spec:
  selector:
    app: bff-service
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

### User Service Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: confluence-clone
spec:
  replicas: 2
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: confluence-clone/user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_URL
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: confluence-clone
spec:
  selector:
    app: user-service
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
```

### Frontend Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: confluence-clone
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: confluence-clone/frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: confluence-clone
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### Ingress Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: confluence-clone-ingress
  namespace: confluence-clone
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - app.confluence-clone.com
    secretName: confluence-clone-tls
  rules:
  - host: app.confluence-clone.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: bff-service
            port:
              number: 3000
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: bff-service
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

## Database Setup

### PostgreSQL Configuration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: confluence-clone
data:
  POSTGRES_DB: "confluence"
  POSTGRES_USER: "confluence_user"
  POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: confluence-clone
type: Opaque
data:
  POSTGRES_PASSWORD: <base64-encoded-password>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: confluence-clone
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: confluence-clone
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### Redis Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: confluence-clone
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:6-alpine
        ports:
        - containerPort: 6379
        command: ["redis-server", "--appendonly", "yes"]
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: confluence-clone
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run security audit
      run: npm audit --audit-level moderate

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push BFF service
      uses: docker/build-push-action@v3
      with:
        context: ./services/bff
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/bff:latest
    
    - name: Build and push User service
      uses: docker/build-push-action@v3
      with:
        context: ./services/user
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/user-service:latest
    
    - name: Build and push Frontend
      uses: docker/build-push-action@v3
      with:
        context: ./frontend
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG }}
    
    - name: Deploy to Kubernetes
      run: |
        kubectl apply -f k8s/
        kubectl rollout status deployment/bff-service -n confluence-clone
        kubectl rollout status deployment/user-service -n confluence-clone
        kubectl rollout status deployment/frontend -n confluence-clone
```

## Monitoring and Observability

### Prometheus Configuration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: confluence-clone
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'bff-service'
      static_configs:
      - targets: ['bff-service:3000']
    - job_name: 'user-service'
      static_configs:
      - targets: ['user-service:3001']
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
```

### Grafana Dashboard
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard
  namespace: confluence-clone
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "Confluence Clone Metrics",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])"
              }
            ]
          }
        ]
      }
    }
```

## Backup and Recovery

### Database Backup
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="confluence_backup_${DATE}.sql"

# Create backup
kubectl exec -n confluence-clone postgres-0 -- pg_dump -U confluence_user confluence > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" s3://confluence-backups/database/

# Cleanup old backups (keep 30 days)
find ${BACKUP_DIR} -name "confluence_backup_*.sql.gz" -mtime +30 -delete
```

### Application Data Backup
```bash
#!/bin/bash
# backup-application-data.sh

# Backup file uploads
kubectl exec -n confluence-clone frontend-0 -- tar -czf /tmp/uploads.tar.gz /app/uploads
kubectl cp confluence-clone/frontend-0:/tmp/uploads.tar.gz ./uploads_backup_$(date +%Y%m%d).tar.gz

# Backup configuration
kubectl get configmap app-config -n confluence-clone -o yaml > config_backup_$(date +%Y%m%d).yaml
kubectl get secret app-secrets -n confluence-clone -o yaml > secrets_backup_$(date +%Y%m%d).yaml
```

## Environment-Specific Configurations

### Development
```yaml
# k8s/overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patchesStrategicMerge:
- deployment-patch.yaml

configMapGenerator:
- name: app-config
  literals:
  - NODE_ENV=development
  - LOG_LEVEL=debug
```

### Staging
```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patchesStrategicMerge:
- deployment-patch.yaml

configMapGenerator:
- name: app-config
  literals:
  - NODE_ENV=staging
  - LOG_LEVEL=info
```

### Production
```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patchesStrategicMerge:
- deployment-patch.yaml

configMapGenerator:
- name: app-config
  literals:
  - NODE_ENV=production
  - LOG_LEVEL=warn
```

## Deployment Commands

### Initial Deployment
```bash
# Create namespace
kubectl create namespace confluence-clone

# Apply base configuration
kubectl apply -f k8s/base/

# Apply environment-specific configuration
kubectl apply -k k8s/overlays/production/

# Check deployment status
kubectl get pods -n confluence-clone
kubectl get services -n confluence-clone
kubectl get ingress -n confluence-clone
```

### Rolling Updates
```bash
# Update BFF service
kubectl set image deployment/bff-service bff-service=confluence-clone/bff:v2.0.0 -n confluence-clone

# Check rollout status
kubectl rollout status deployment/bff-service -n confluence-clone

# Rollback if needed
kubectl rollout undo deployment/bff-service -n confluence-clone
```

### Scaling
```bash
# Scale BFF service
kubectl scale deployment bff-service --replicas=5 -n confluence-clone

# Auto-scaling configuration
kubectl autoscale deployment bff-service --cpu-percent=70 --min=2 --max=10 -n confluence-clone
```
