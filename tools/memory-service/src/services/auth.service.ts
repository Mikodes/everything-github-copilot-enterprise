import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/client.js';
import { getCache } from '../cache/client.js';
import { createChildLogger } from '../utils/logger.js';
import { config } from '../config/index.js';
import {
  User,
  Role,
  Permission,
  Organization,
  CreateUser,
  CreateOrganization,
} from '../models/index.js';
import crypto from 'crypto';

const logger = createChildLogger('auth-service');

interface TokenPayload {
  userId: string;
  email: string;
  organizationId?: string;
  permissions: Permission[];
}

interface OrganizationMember {
  userId: string;
  organizationId: string;
  roleId: string;
  role: Role;
}

export class AuthService {
  private readonly CACHE_TTL = 300; // 5 minutes

  // ============================================
  // User Management
  // ============================================

  async createUser(data: CreateUser): Promise<User> {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date();

    const result = await db.query<User>(
      `INSERT INTO users (id, email, name, avatar_url, external_id, provider, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        data.email.toLowerCase(),
        data.name,
        data.avatarUrl,
        data.externalId,
        data.provider ?? 'local',
        JSON.stringify(data.metadata ?? {}),
        now,
        now,
      ]
    );

    logger.info({ userId: id, email: data.email }, 'User created');

    return this.mapUserRow(result.rows[0]!);
  }

  async getUserById(id: string): Promise<User | null> {
    const cache = getCache();
    const cacheKey = `user:${id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as User;
    }

    const db = getDatabase();
    const result = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = this.mapUserRow(result.rows[0]!);
    await cache.set(cacheKey, JSON.stringify(user), this.CACHE_TTL);

    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = getDatabase();
    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserRow(result.rows[0]!);
  }

  async getUserByExternalId(externalId: string, provider: string): Promise<User | null> {
    const db = getDatabase();
    const result = await db.query<User>(
      'SELECT * FROM users WHERE external_id = $1 AND provider = $2',
      [externalId, provider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserRow(result.rows[0]!);
  }

  // ============================================
  // Organization Management
  // ============================================

  async createOrganization(data: CreateOrganization): Promise<Organization> {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date();

    const result = await db.query<Organization>(
      `INSERT INTO organizations (id, name, slug, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.name, data.slug, JSON.stringify(data.settings ?? {}), now, now]
    );

    logger.info({ organizationId: id, slug: data.slug }, 'Organization created');

    return this.mapOrganizationRow(result.rows[0]!);
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const db = getDatabase();
    const result = await db.query<Organization>(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapOrganizationRow(result.rows[0]!);
  }

  // ============================================
  // Role & Permission Management
  // ============================================

  async getRoleById(id: string): Promise<Role | null> {
    const cache = getCache();
    const cacheKey = `role:${id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Role;
    }

    const db = getDatabase();
    const result = await db.query<Role>(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const role = this.mapRoleRow(result.rows[0]!);
    await cache.set(cacheKey, JSON.stringify(role), this.CACHE_TTL);

    return role;
  }

  async getRoleByName(name: string, organizationId?: string): Promise<Role | null> {
    const db = getDatabase();
    const result = await db.query<Role>(
      `SELECT * FROM roles WHERE name = $1 AND (organization_id = $2 OR organization_id IS NULL)
       ORDER BY organization_id DESC NULLS LAST LIMIT 1`,
      [name, organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRoleRow(result.rows[0]!);
  }

  async getSystemRoles(): Promise<Role[]> {
    const db = getDatabase();
    const result = await db.query<Role>(
      'SELECT * FROM roles WHERE is_system = true ORDER BY name'
    );

    return result.rows.map((row) => this.mapRoleRow(row));
  }

  // ============================================
  // Organization Membership
  // ============================================

  async addUserToOrganization(
    userId: string,
    organizationId: string,
    roleName: string = 'viewer'
  ): Promise<void> {
    const db = getDatabase();

    const role = await this.getRoleByName(roleName, organizationId);
    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    await db.query(
      `INSERT INTO organization_members (id, user_id, organization_id, role_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id, organization_id) DO UPDATE SET role_id = $4, updated_at = NOW()`,
      [uuidv4(), userId, organizationId, role.id]
    );

    // Invalidate cache
    await this.invalidateUserPermissionsCache(userId);

    logger.info({ userId, organizationId, role: roleName }, 'User added to organization');
  }

  async removeUserFromOrganization(userId: string, organizationId: string): Promise<void> {
    const db = getDatabase();

    await db.query(
      'DELETE FROM organization_members WHERE user_id = $1 AND organization_id = $2',
      [userId, organizationId]
    );

    await this.invalidateUserPermissionsCache(userId);

    logger.info({ userId, organizationId }, 'User removed from organization');
  }

  async getUserOrganizations(userId: string): Promise<{ organization: Organization; role: Role }[]> {
    const db = getDatabase();

    const result = await db.query(
      `SELECT o.*, r.id as role_id, r.name as role_name, r.permissions as role_permissions
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = $1`,
      [userId]
    );

    return result.rows.map((row) => ({
      organization: this.mapOrganizationRow(row as Record<string, unknown>),
      role: {
        id: row['role_id'] as string,
        name: row['role_name'] as string,
        permissions: row['role_permissions'] as Permission[],
        description: null,
        organizationId: null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }

  // ============================================
  // Permission Checking
  // ============================================

  async getUserPermissions(userId: string, organizationId: string): Promise<Permission[]> {
    const cache = getCache();
    const cacheKey = `permissions:${userId}:${organizationId}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Permission[];
    }

    const db = getDatabase();

    const result = await db.query<{ permissions: Permission[] }>(
      `SELECT r.permissions
       FROM organization_members om
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [userId, organizationId]
    );

    if (result.rows.length === 0) {
      return [];
    }

    const permissions = result.rows[0]!['permissions'] ?? [];
    await cache.set(cacheKey, JSON.stringify(permissions), this.CACHE_TTL);

    return permissions;
  }

  async hasPermission(
    userId: string,
    organizationId: string,
    requiredPermission: Permission
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, organizationId);

    // Admin has all permissions
    if (permissions.includes('*')) {
      return true;
    }

    return permissions.includes(requiredPermission);
  }

  async hasAnyPermission(
    userId: string,
    organizationId: string,
    requiredPermissions: Permission[]
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, organizationId);

    if (permissions.includes('*')) {
      return true;
    }

    return requiredPermissions.some((p) => permissions.includes(p));
  }

  // ============================================
  // Audit Logging
  // ============================================

  async logAudit(params: {
    organizationId?: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const db = getDatabase();

    await db.query(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, action, entity_type, entity_id,
        changes, ip_address, user_agent, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        uuidv4(),
        params.organizationId,
        params.userId,
        params.action,
        params.entityType,
        params.entityId,
        params.changes ? JSON.stringify(params.changes) : null,
        params.ipAddress,
        params.userAgent,
        JSON.stringify(params.metadata ?? {}),
      ]
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async invalidateUserPermissionsCache(userId: string): Promise<void> {
    const cache = getCache();
    const keys = await cache.keys(`permissions:${userId}:*`);
    for (const key of keys) {
      await cache.del(key);
    }
    await cache.del(`user:${userId}`);
  }

  private mapUserRow(row: Record<string, unknown>): User {
    return {
      id: row['id'] as string,
      email: row['email'] as string,
      name: row['name'] as string,
      avatarUrl: row['avatar_url'] as string | null,
      externalId: row['external_id'] as string | null,
      provider: row['provider'] as User['provider'],
      metadata: (row['metadata'] as Record<string, unknown>) ?? {},
      lastLoginAt: row['last_login_at'] ? new Date(row['last_login_at'] as string) : null,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }

  private mapOrganizationRow(row: Record<string, unknown>): Organization {
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      slug: row['slug'] as string,
      settings: (row['settings'] as Record<string, unknown>) ?? {},
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }

  private mapRoleRow(row: Record<string, unknown>): Role {
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      description: row['description'] as string | null,
      permissions: row['permissions'] as Permission[],
      organizationId: row['organization_id'] as string | null,
      isSystem: row['is_system'] as boolean,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}

// Singleton instance
let authService: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}
