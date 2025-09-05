# Confluence Clone POC

A proof-of-concept application for real-time collaborative document editing, built with TypeScript, React, and Node.js.

## Features

- ✅ **Real-time Collaborative Editing**: Multiple users can edit documents simultaneously
- ✅ **Operational Transform**: Automatic conflict resolution using OT algorithms
- ✅ **Share via URL**: Anyone with the link can join and edit
- ✅ **User Presence**: See who's currently editing with avatars and names
- ✅ **Dummy User Generation**: Automatic user names and colored avatars
- ✅ **File-based Storage**: No database required - uses JSON files
- ✅ **Atlassian UI Kit**: Professional UI components
- ✅ **WebSocket Communication**: Real-time bidirectional communication

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Atlassian UI Kit** for components
- **Socket.IO Client** for real-time communication
- **React Router** for navigation

### Backend
- **Node.js** with Express
- **Socket.IO** for WebSocket connections
- **Operational Transform** for conflict resolution
- **JSON file storage** for persistence

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Git

### Installation

1. **Clone and install dependencies:**
```bash
cd poc
npm run install:all
```

2. **Start the development servers:**
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend React app on `http://localhost:3000`

### Usage

1. **Create a new document:**
   - Click "Create New Document"
   - Enter a title
   - Start editing

2. **Share a document:**
   - Click "Share" button in the editor
   - Copy the URL and share with others
   - Anyone with the link can join and edit

3. **Real-time collaboration:**
   - See other users' avatars in the header
   - Watch changes appear in real-time
   - Automatic conflict resolution

## Architecture

### Real-time Collaboration Flow

```
[User A] ←→ [WebSocket] ←→ [Server] ←→ [WebSocket] ←→ [User B]
                ↓
            [JSON File Storage]
```

### Operational Transform Implementation

The application uses Operational Transform (OT) to resolve conflicts:

1. **Local Operations**: Applied immediately for responsive UI
2. **Server Processing**: Operations are transformed and applied
3. **Broadcast**: Transformed operations sent to all connected users
4. **Conflict Resolution**: Automatic resolution through OT algorithms

### File Structure

```
poc/
├── server/
│   ├── index.js              # Express server with Socket.IO
│   └── documents/            # JSON file storage directory
├── client/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript type definitions
│   │   └── contexts/        # React contexts
│   └── public/              # Static assets
└── package.json             # Root package configuration
```

## API Endpoints

### REST API
- `GET /api/documents/:id` - Get document by ID
- `POST /api/documents` - Create new document

### WebSocket Events
- `join-document` - Join a document for collaboration
- `operation` - Send document operation (insert/delete)
- `cursor-update` - Update cursor position
- `user-joined` - User joined notification
- `user-left` - User left notification

## Storage

Documents are stored as JSON files in the `server/documents/` directory:

```json
{
  "id": "uuid",
  "title": "Document Title",
  "content": "Document content...",
  "operations": [...],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "activeUsers": {...}
}
```

## Development

### Available Scripts

- `npm run dev` - Start both frontend and backend
- `npm run server:dev` - Start backend only
- `npm run client:dev` - Start frontend only
- `npm run build` - Build for production
- `npm start` - Start production server

### Adding Features

1. **New UI Components**: Add to `client/src/components/`
2. **API Endpoints**: Add to `server/index.js`
3. **WebSocket Events**: Extend the Socket.IO handlers
4. **Types**: Add TypeScript definitions in `client/src/types/`

## Limitations

This is a POC with the following limitations:

- **No Authentication**: Anyone with the URL can edit
- **No User Management**: Dummy users with random names
- **File-based Storage**: Not suitable for production scale
- **No Offline Support**: Requires active connection
- **Simple OT**: Basic implementation, not production-ready

## Production Considerations

For a production system, consider:

- **Database**: PostgreSQL or MongoDB for document storage
- **Authentication**: User accounts and permissions
- **Scalability**: Redis for session management, load balancing
- **Security**: Input validation, rate limiting, HTTPS
- **Monitoring**: Logging, metrics, error tracking
- **Testing**: Unit tests, integration tests, load testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
