# Data Models and Database Schema

## Database Design Overview

The system uses PostgreSQL as the primary database with the following core entities and relationships:

## Core Entities

### 1. Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE user_role AS ENUM ('admin', 'space_admin', 'editor', 'viewer');
```

### 2. Spaces Table
```sql
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Pages Table
```sql
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'html',
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_draft BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    permissions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Page Versions Table
```sql
CREATE TABLE page_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'html',
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(page_id, version)
);
```

### 5. Comments Table
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text_range JSONB, -- {start: {line: 0, ch: 0}, end: {line: 0, ch: 10}}
    mentioned_users UUID[] DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. User Permissions Table
```sql
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- 'space', 'page', 'global'
    resource_id UUID, -- NULL for global permissions
    permission VARCHAR(50) NOT NULL, -- 'read', 'write', 'admin', 'delete'
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    UNIQUE(user_id, resource_type, resource_id, permission)
);
```

### 7. Space Members Table
```sql
CREATE TABLE space_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'admin', 'editor', 'viewer'
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(space_id, user_id)
);
```

### 8. Collaboration Sessions Table
```sql
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    cursor_position JSONB, -- {line: 0, ch: 0}
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(page_id, user_id, session_id)
);
```

### 9. Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'comment', 'mention', 'page_update', 'space_invite'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional context data
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 10. Templates Table
```sql
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'html',
    category VARCHAR(100), -- 'meeting_notes', 'project_plan', 'knowledge_base'
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 11. API Keys Table
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '{}',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 12. Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout'
    resource_type VARCHAR(50) NOT NULL, -- 'user', 'space', 'page', 'comment'
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Indexes for Performance

```sql
-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Spaces indexes
CREATE INDEX idx_spaces_owner ON spaces(owner_id);
CREATE INDEX idx_spaces_slug ON spaces(slug);
CREATE INDEX idx_spaces_public ON spaces(is_public);

-- Pages indexes
CREATE INDEX idx_pages_space ON pages(space_id);
CREATE INDEX idx_pages_parent ON pages(parent_id);
CREATE INDEX idx_pages_author ON pages(author_id);
CREATE INDEX idx_pages_draft ON pages(is_draft);
CREATE INDEX idx_pages_archived ON pages(is_archived);
CREATE INDEX idx_pages_updated ON pages(updated_at);
CREATE INDEX idx_pages_title_search ON pages USING gin(to_tsvector('english', title));

-- Page versions indexes
CREATE INDEX idx_page_versions_page ON page_versions(page_id);
CREATE INDEX idx_page_versions_version ON page_versions(page_id, version);

-- Comments indexes
CREATE INDEX idx_comments_page ON comments(page_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_mentioned ON comments USING gin(mentioned_users);

-- Permissions indexes
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_resource ON user_permissions(resource_type, resource_id);

-- Space members indexes
CREATE INDEX idx_space_members_space ON space_members(space_id);
CREATE INDEX idx_space_members_user ON space_members(user_id);

-- Collaboration indexes
CREATE INDEX idx_collaboration_page ON collaboration_sessions(page_id);
CREATE INDEX idx_collaboration_user ON collaboration_sessions(user_id);
CREATE INDEX idx_collaboration_active ON collaboration_sessions(is_active);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

## Data Relationships

### Entity Relationship Diagram
```
Users (1) ←→ (N) Spaces [owner relationship]
Users (1) ←→ (N) Pages [author relationship]
Users (1) ←→ (N) Comments [author relationship]
Users (1) ←→ (N) Notifications [recipient relationship]

Spaces (1) ←→ (N) Pages [containment relationship]
Pages (1) ←→ (N) Pages [parent-child hierarchy]
Pages (1) ←→ (N) Page Versions [versioning relationship]
Pages (1) ←→ (N) Comments [comment relationship]

Users (N) ←→ (N) Spaces [membership via space_members]
Users (N) ←→ (N) Pages [permissions via user_permissions]
```

## Data Validation Rules

### Business Rules
1. **User Management**
   - Email must be unique and valid format
   - Password must meet security requirements
   - Role changes require admin privileges

2. **Space Management**
   - Space names must be unique within organization
   - Only space admins can modify space settings
   - Public spaces are visible to all users

3. **Page Management**
   - Page titles cannot be empty
   - Draft pages are only visible to authors and space admins
   - Archived pages are hidden from normal views
   - Version numbers are auto-incremented

4. **Collaboration**
   - Only one user can lock a page at a time
   - Collaboration sessions expire after inactivity
   - Comments can be nested up to 3 levels deep

5. **Permissions**
   - Global permissions override resource-specific permissions
   - Permission inheritance from parent to child resources
   - Expired permissions are automatically revoked

## Data Migration Strategy

### Version Control
- Database schema versioning using migration files
- Backward compatibility for API changes
- Data migration scripts for schema updates

### Backup and Recovery
- Daily automated backups
- Point-in-time recovery capability
- Cross-region backup replication
- Regular backup restoration testing
