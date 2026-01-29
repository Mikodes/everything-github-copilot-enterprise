import { describe, it, expect } from 'vitest';
import {
  UserSchema,
  OrganizationSchema,
  ProjectSchema,
  ContextEntrySchema,
  SearchQuerySchema,
  PermissionSchema,
  RoleSchema,
} from '../../src/models/index.js';

describe('Models', () => {
  describe('UserSchema', () => {
    it('should validate a valid user', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        externalId: null,
        provider: 'local',
        metadata: {},
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = UserSchema.safeParse(user);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        name: 'Test User',
        avatarUrl: null,
        externalId: null,
        provider: 'local',
        metadata: {},
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = UserSchema.safeParse(user);
      expect(result.success).toBe(false);
    });
  });

  describe('OrganizationSchema', () => {
    it('should validate a valid organization', () => {
      const org = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Org',
        slug: 'test-org',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = OrganizationSchema.safeParse(org);
      expect(result.success).toBe(true);
    });

    it('should reject invalid slug', () => {
      const org = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Org',
        slug: 'Invalid Slug With Spaces',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = OrganizationSchema.safeParse(org);
      expect(result.success).toBe(false);
    });
  });

  describe('ContextEntrySchema', () => {
    it('should validate a valid context entry', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        moduleId: null,
        type: 'adr',
        title: 'Test ADR',
        content: '# Test Content',
        contentFormat: 'markdown',
        status: 'active',
        supersededBy: null,
        tags: ['test', 'adr'],
        metadata: {},
        embedding: null,
        version: 1,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ContextEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        moduleId: null,
        type: 'invalid-type',
        title: 'Test',
        content: 'Content',
        contentFormat: 'markdown',
        status: 'active',
        supersededBy: null,
        tags: [],
        metadata: {},
        embedding: null,
        version: 1,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ContextEntrySchema.safeParse(entry);
      expect(result.success).toBe(false);
    });
  });

  describe('SearchQuerySchema', () => {
    it('should validate a valid search query', () => {
      const query = {
        query: 'test search',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 10,
        offset: 0,
        semantic: true,
        minSimilarity: 0.7,
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const query = {
        query: 'test',
        projectId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
        expect(result.data.semantic).toBe(true);
        expect(result.data.minSimilarity).toBe(0.7);
      }
    });
  });

  describe('PermissionSchema', () => {
    it('should validate valid permissions', () => {
      const validPermissions = [
        '*',
        'project:read',
        'context:write',
        'audit:read',
      ];

      for (const permission of validPermissions) {
        const result = PermissionSchema.safeParse(permission);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid permissions', () => {
      const result = PermissionSchema.safeParse('invalid:permission');
      expect(result.success).toBe(false);
    });
  });
});
