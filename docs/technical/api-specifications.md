# API Specifications

## API Overview

The Confluence-like platform exposes a RESTful API through the BFF (Backend for Frontend) layer, providing endpoints for all major functionality including user management, document operations, collaboration, and search.

## Base URL and Versioning

```
Base URL: https://api.confluence-clone.com/v1
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

## Authentication

### JWT Token Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "editor",
  "permissions": ["read", "write"],
  "iat": 1642248000,
  "exp": 1642251600
}
```

### Authentication Endpoints

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "editor",
    "avatar": "https://example.com/avatar.jpg"
  },
  "expiresIn": 3600
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <jwt_token>
```

## User Management API

### Get User Profile
```http
GET /users/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": "https://example.com/avatar.jpg",
  "role": "editor",
  "permissions": ["read", "write"],
  "spaces": [
    {
      "id": "space_uuid",
      "name": "Project Alpha",
      "role": "editor"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "lastLoginAt": "2024-01-15T09:15:00Z"
}
```

### Update User Profile
```http
PUT /users/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "John Smith",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

### Get All Users (Admin Only)
```http
GET /users?page=1&limit=20&role=editor
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "editor",
      "isActive": true,
      "lastLoginAt": "2024-01-15T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Create User (Admin Only)
```http
POST /users
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "Jane Doe",
  "role": "editor",
  "spaceIds": ["space_uuid_1", "space_uuid_2"]
}
```

### Update User Role (Admin Only)
```http
PUT /users/{userId}/role
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "role": "space_admin",
  "spaceIds": ["space_uuid"]
}
```

## Spaces API

### Get All Spaces
```http
GET /spaces?page=1&limit=20&public=true
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "spaces": [
    {
      "id": "uuid",
      "name": "Project Alpha",
      "description": "Main project documentation",
      "slug": "project-alpha",
      "owner": {
        "id": "user_uuid",
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "isPublic": false,
      "memberCount": 15,
      "pageCount": 42,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Create Space
```http
POST /spaces
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "New Project",
  "description": "Documentation for new project",
  "isPublic": false,
  "permissions": {
    "defaultRole": "viewer",
    "allowPublicRead": false
  }
}
```

### Get Space Details
```http
GET /spaces/{spaceId}
Authorization: Bearer <jwt_token>
```

### Update Space
```http
PUT /spaces/{spaceId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Project Name",
  "description": "Updated description",
  "isPublic": true
}
```

### Delete Space
```http
DELETE /spaces/{spaceId}
Authorization: Bearer <jwt_token>
```

## Pages API

### Get Space Pages
```http
GET /spaces/{spaceId}/pages?page=1&limit=20&draft=false&archived=false
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "pages": [
    {
      "id": "uuid",
      "title": "Getting Started",
      "spaceId": "space_uuid",
      "parentId": null,
      "author": {
        "id": "user_uuid",
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "isDraft": false,
      "isArchived": false,
      "version": 3,
      "orderIndex": 0,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### Create Page
```http
POST /spaces/{spaceId}/pages
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "New Page",
  "content": "<h1>Page Content</h1><p>This is the page content.</p>",
  "parentId": "parent_page_uuid",
  "isDraft": true,
  "templateId": "template_uuid"
}
```

### Get Page Content
```http
GET /pages/{pageId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Getting Started",
  "content": "<h1>Getting Started</h1><p>Welcome to our platform...</p>",
  "contentType": "html",
  "spaceId": "space_uuid",
  "parentId": null,
  "author": {
    "id": "user_uuid",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg"
  },
  "isDraft": false,
  "isArchived": false,
  "isLocked": false,
  "lockedBy": null,
  "version": 3,
  "orderIndex": 0,
  "permissions": {
    "read": ["user_uuid_1", "user_uuid_2"],
    "write": ["user_uuid_1"]
  },
  "metadata": {
    "tags": ["documentation", "getting-started"],
    "category": "guide"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T14:20:00Z"
}
```

### Update Page
```http
PUT /pages/{pageId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Updated Page Title",
  "content": "<h1>Updated Content</h1><p>This is updated content.</p>",
  "isDraft": false,
  "metadata": {
    "tags": ["updated", "documentation"]
  }
}
```

### Delete Page
```http
DELETE /pages/{pageId}
Authorization: Bearer <jwt_token>
```

### Archive Page
```http
PUT /pages/{pageId}/archive
Authorization: Bearer <jwt_token>
```

### Publish Draft
```http
PUT /pages/{pageId}/publish
Authorization: Bearer <jwt_token>
```

## Version History API

### Get Page Versions
```http
GET /pages/{pageId}/versions?page=1&limit=10
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "versions": [
    {
      "id": "version_uuid",
      "version": 3,
      "title": "Getting Started",
      "content": "<h1>Getting Started</h1><p>Updated content...</p>",
      "author": {
        "id": "user_uuid",
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "changeSummary": "Updated introduction section",
      "createdAt": "2024-01-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1
  }
}
```

### Get Specific Version
```http
GET /pages/{pageId}/versions/{versionId}
Authorization: Bearer <jwt_token>
```

### Restore Version
```http
POST /pages/{pageId}/versions/{versionId}/restore
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "reason": "Reverting to previous stable version"
}
```

## Comments API

### Get Page Comments
```http
GET /pages/{pageId}/comments?page=1&limit=20
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "comments": [
    {
      "id": "comment_uuid",
      "content": "This section needs clarification",
      "author": {
        "id": "user_uuid",
        "name": "Jane Smith",
        "avatar": "https://example.com/avatar.jpg"
      },
      "textRange": {
        "start": {"line": 5, "ch": 10},
        "end": {"line": 5, "ch": 25}
      },
      "mentionedUsers": [
        {
          "id": "mentioned_user_uuid",
          "name": "John Doe"
        }
      ],
      "isResolved": false,
      "replies": [
        {
          "id": "reply_uuid",
          "content": "I'll update that section",
          "author": {
            "id": "user_uuid",
            "name": "John Doe"
          },
          "createdAt": "2024-01-15T15:30:00Z"
        }
      ],
      "createdAt": "2024-01-15T14:30:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Create Comment
```http
POST /pages/{pageId}/comments
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "This section needs clarification @john.doe",
  "textRange": {
    "start": {"line": 5, "ch": 10},
    "end": {"line": 5, "ch": 25}
  },
  "parentId": "parent_comment_uuid"
}
```

### Update Comment
```http
PUT /comments/{commentId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "Updated comment content"
}
```

### Delete Comment
```http
DELETE /comments/{commentId}
Authorization: Bearer <jwt_token>
```

## Search API

### Search Content
```http
GET /search?q=getting+started&space=space_uuid&author=user_uuid&date=2024-01-01,2024-01-31&page=1&limit=20
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "results": [
    {
      "id": "page_uuid",
      "title": "Getting Started Guide",
      "content": "This guide will help you get started...",
      "space": {
        "id": "space_uuid",
        "name": "Project Alpha"
      },
      "author": {
        "id": "user_uuid",
        "name": "John Doe"
      },
      "score": 0.95,
      "highlights": {
        "title": ["<mark>Getting Started</mark> Guide"],
        "content": ["This guide will help you <mark>get started</mark> with our platform..."]
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  },
  "facets": {
    "spaces": [
      {"id": "space_uuid", "name": "Project Alpha", "count": 10},
      {"id": "space_uuid_2", "name": "Project Beta", "count": 5}
    ],
    "authors": [
      {"id": "user_uuid", "name": "John Doe", "count": 8},
      {"id": "user_uuid_2", "name": "Jane Smith", "count": 7}
    ]
  }
}
```

### Search Suggestions
```http
GET /search/suggestions?q=get
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "suggestions": [
    "getting started",
    "getting help",
    "get started guide"
  ]
}
```

## Notifications API

### Get Notifications
```http
GET /notifications?page=1&limit=20&unread=true
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "notification_uuid",
      "type": "comment",
      "title": "New comment on 'Getting Started'",
      "message": "Jane Smith commented on your page",
      "data": {
        "pageId": "page_uuid",
        "commentId": "comment_uuid",
        "spaceId": "space_uuid"
      },
      "isRead": false,
      "createdAt": "2024-01-15T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "unreadCount": 3
}
```

### Mark Notification as Read
```http
PUT /notifications/{notificationId}/read
Authorization: Bearer <jwt_token>
```

### Update Notification Preferences
```http
PUT /notifications/preferences
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": {
    "comments": true,
    "mentions": true,
    "pageUpdates": false,
    "spaceInvites": true
  },
  "inApp": {
    "comments": true,
    "mentions": true,
    "pageUpdates": true,
    "spaceInvites": true
  }
}
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('wss://api.confluence-clone.com/v1/ws', {
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
});
```

### Join Collaboration Room
```json
{
  "type": "join",
  "room": "page_uuid",
  "userId": "user_uuid"
}
```

### Send Operation
```json
{
  "type": "operation",
  "room": "page_uuid",
  "operation": {
    "type": "insert",
    "position": 10,
    "content": "Hello",
    "timestamp": 1642248000000
  }
}
```

### Presence Update
```json
{
  "type": "presence",
  "room": "page_uuid",
  "cursor": {
    "line": 5,
    "ch": 10
  }
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_uuid"
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` (401): Invalid or missing authentication
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `CONFLICT` (409): Resource conflict (e.g., duplicate email)
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

## Rate Limiting

### Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642251600
X-RateLimit-Retry-After: 60
```

### Limits
- **Authentication**: 5 requests per minute
- **General API**: 1000 requests per hour
- **Search**: 100 requests per hour
- **WebSocket**: 10 connections per user
