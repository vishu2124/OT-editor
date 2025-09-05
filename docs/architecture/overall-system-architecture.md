# Overall System Architecture

## Architecture Overview
Microservices-based Confluence-like platform with BFF (Backend for Frontend) layer and React frontend.

## Components
- **Frontend**: React SPA with Tailwind CSS
- **BFF Layer**: API Gateway and orchestration
- **Microservices**: User, Document, Collaboration, Search, Notification services
- **Database**: PostgreSQL (primary), Elasticsearch (search), Redis (cache)
- **Real-time**: WebSocket connections for collaboration

## Technology Stack
- Frontend: React, Tailwind CSS, Socket.IO Client
- BFF: Node.js/Express or Python/FastAPI
- Microservices: Node.js/Express or Python/FastAPI
- Database: PostgreSQL, Elasticsearch, Redis
- Authentication: JWT, OAuth 2.0
- Real-time: Socket.IO, WebSocket
