# Architecture Documentation

This directory contains sequence diagrams and architecture documentation for the Confluence-like collaboration platform.

## Files Overview

### System Architecture
- `overall-system-architecture.mermaid` - High-level system architecture diagram showing microservices, BFF layer, and data flow
- `overall-system-architecture.md` - Architecture overview and technology stack details

### Feature Sequence Diagrams
- `user-management-sequence.mermaid` - User authentication, RBAC, and role management flows
- `document-management-sequence.mermaid` - Space/page creation, versioning, search, and archiving
- `collaboration-editing-sequence.mermaid` - Real-time editing, presence indicators, comments, and document locking
- `ui-integrations-sequence.mermaid` - WYSIWYG editor, third-party embeddings, navigation, and API access

### Integration Documentation
- `microservices-bff-integration.md` - Detailed integration patterns, communication flows, and resilience strategies
- `service-communication-diagram.mermaid` - Visual representation of service communication patterns
- `api-contracts.md` - Complete API specifications, DTOs, and error handling contracts

## Architecture Principles

### Microservices Design
- **User Service**: Handles authentication, authorization, and user management
- **Document Service**: Manages spaces, pages, versioning, and content CRUD
- **Collaboration Service**: Real-time editing, presence, and conflict resolution
- **Search Service**: Full-text search and indexing
- **Notification Service**: Email and in-app notifications

### BFF (Backend for Frontend) Layer
- API Gateway for request routing and orchestration
- Authentication and authorization middleware
- Request/response transformation
- Rate limiting and caching

### Data Layer
- **PostgreSQL**: Primary database for relational data
- **Elasticsearch**: Full-text search and indexing
- **Redis**: Caching, sessions, and real-time data

### Real-time Communication
- WebSocket connections for collaborative editing
- CRDT (Conflict-free Replicated Data Types) for conflict resolution
- Presence indicators and live cursors

## Technology Stack
- **Frontend**: React, Tailwind CSS, Socket.IO Client
- **BFF**: Node.js/Express or Python/FastAPI
- **Microservices**: Node.js/Express or Python/FastAPI
- **Database**: PostgreSQL, Elasticsearch, Redis
- **Authentication**: JWT, OAuth 2.0, SSO
- **Real-time**: Socket.IO, WebSocket
