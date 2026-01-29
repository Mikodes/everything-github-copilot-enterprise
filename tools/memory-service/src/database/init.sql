-- EGCE Memory Bank Database Schema
-- Version: 1.0.0
-- Description: PostgreSQL schema with pgvector for semantic search

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- RBAC (Role-Based Access Control) Tables
-- ============================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(512),
    external_id VARCHAR(255), -- For OIDC/SAML integration
    provider VARCHAR(50) DEFAULT 'local', -- local, github, azure-ad, okta
    metadata JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]', -- Array of permission strings
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    is_system BOOLEAN DEFAULT FALSE, -- System roles can't be deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, organization_id)
);

-- User organization memberships
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- ============================================
-- Memory Bank Core Tables
-- ============================================

-- Projects table (repositories/workspaces)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    repository_url VARCHAR(512),
    default_branch VARCHAR(100) DEFAULT 'main',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- Modules table (logical groupings within projects)
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(512), -- Path in repository
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);

-- Context entries (main Memory Bank content)
CREATE TABLE IF NOT EXISTS context_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,

    -- Content
    type VARCHAR(50) NOT NULL, -- 'adr', 'pattern', 'knowledge', 'troubleshooting', 'context'
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_format VARCHAR(20) DEFAULT 'markdown', -- markdown, json, yaml

    -- Metadata
    status VARCHAR(50) DEFAULT 'active', -- active, deprecated, superseded, draft
    superseded_by UUID REFERENCES context_entries(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Vector embedding for semantic search
    embedding vector(1536),

    -- Versioning
    version INTEGER DEFAULT 1,

    -- Audit
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Context entry versions (history)
CREATE TABLE IF NOT EXISTS context_entry_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES context_entries(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entry_id, version)
);

-- Relations between context entries
CREATE TABLE IF NOT EXISTS context_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES context_entries(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES context_entries(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL, -- 'depends_on', 'supersedes', 'relates_to', 'implements'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, target_id, relation_type)
);

-- ============================================
-- ADR (Architecture Decision Records) Tables
-- ============================================

CREATE TABLE IF NOT EXISTS adrs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context_entry_id UUID NOT NULL REFERENCES context_entries(id) ON DELETE CASCADE,
    adr_number INTEGER NOT NULL,
    decision_date DATE,
    decision_makers TEXT[],
    pros TEXT[],
    cons TEXT[],
    alternatives JSONB DEFAULT '[]', -- Array of {title, description, rejected_reason}
    consequences TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Sync and Collaboration Tables
-- ============================================

-- Sync events for real-time synchronization
CREATE TABLE IF NOT EXISTS sync_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'context_entry', 'module', 'project'
    entity_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
    payload JSONB NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sequence_number BIGSERIAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active sessions for presence awareness
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(512),
    cursor_position JSONB, -- {line, column}
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Audit Log Table
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    changes JSONB, -- {before, after}
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id) WHERE external_id IS NOT NULL;

-- Organization indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Project indexes
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(organization_id, slug);

-- Module indexes
CREATE INDEX IF NOT EXISTS idx_modules_project ON modules(project_id);

-- Context entry indexes
CREATE INDEX IF NOT EXISTS idx_context_entries_project ON context_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_context_entries_module ON context_entries(module_id);
CREATE INDEX IF NOT EXISTS idx_context_entries_type ON context_entries(type);
CREATE INDEX IF NOT EXISTS idx_context_entries_status ON context_entries(status);
CREATE INDEX IF NOT EXISTS idx_context_entries_tags ON context_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_context_entries_title_trgm ON context_entries USING GIN(title gin_trgm_ops);

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX IF NOT EXISTS idx_context_entries_embedding ON context_entries
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Sync events indexes
CREATE INDEX IF NOT EXISTS idx_sync_events_project ON sync_events(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_sequence ON sync_events(project_id, sequence_number);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Active sessions indexes
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_project ON active_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);

-- ============================================
-- Default System Roles
-- ============================================

INSERT INTO roles (name, description, permissions, is_system) VALUES
    ('admin', 'Organization administrator with full access',
     '["*"]'::jsonb, true),
    ('maintainer', 'Can manage projects and content',
     '["project:read", "project:write", "context:read", "context:write", "context:delete", "module:read", "module:write"]'::jsonb, true),
    ('contributor', 'Can create and edit content',
     '["project:read", "context:read", "context:write", "module:read"]'::jsonb, true),
    ('viewer', 'Read-only access',
     '["project:read", "context:read", "module:read"]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_entries_updated_at BEFORE UPDATE ON context_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for semantic search
CREATE OR REPLACE FUNCTION search_context_semantic(
    query_embedding vector(1536),
    project_uuid UUID,
    limit_count INTEGER DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    content TEXT,
    type VARCHAR(50),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.title,
        ce.content,
        ce.type,
        1 - (ce.embedding <=> query_embedding) as similarity
    FROM context_entries ce
    WHERE ce.project_id = project_uuid
        AND ce.status = 'active'
        AND ce.embedding IS NOT NULL
        AND 1 - (ce.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up stale sessions
CREATE OR REPLACE FUNCTION cleanup_stale_sessions(threshold_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM active_sessions
    WHERE last_heartbeat < NOW() - (threshold_minutes || ' minutes')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
