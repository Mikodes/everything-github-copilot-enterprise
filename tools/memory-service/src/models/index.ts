import { z } from 'zod';

// Re-export sync types
export * from './sync.js';

// Re-export knowledge graph types
export * from './knowledge-graph.js';

// ============================================
// Base Types
// ============================================

export const UUIDSchema = z.string().uuid();

export const TimestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================
// Organization
// ============================================

export const OrganizationSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  settings: z.record(z.unknown()).default({}),
  ...TimestampsSchema.shape,
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationSchema = OrganizationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

// ============================================
// User
// ============================================

export const UserProviderSchema = z.enum(['local', 'github', 'azure-ad', 'okta', 'google']);

export const UserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  name: z.string().min(1).max(255),
  avatarUrl: z.string().url().nullable(),
  externalId: z.string().nullable(),
  provider: UserProviderSchema.default('local'),
  metadata: z.record(z.unknown()).default({}),
  lastLoginAt: z.date().nullable(),
  ...TimestampsSchema.shape,
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

// ============================================
// Role & Permissions
// ============================================

export const PermissionSchema = z.enum([
  '*', // Admin - all permissions
  'project:read',
  'project:write',
  'project:delete',
  'context:read',
  'context:write',
  'context:delete',
  'module:read',
  'module:write',
  'module:delete',
  'user:read',
  'user:write',
  'user:delete',
  'role:read',
  'role:write',
  'role:delete',
  'audit:read',
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  permissions: z.array(PermissionSchema),
  organizationId: UUIDSchema.nullable(),
  isSystem: z.boolean().default(false),
  ...TimestampsSchema.shape,
});

export type Role = z.infer<typeof RoleSchema>;

// ============================================
// Project
// ============================================

export const ProjectSchema = z.object({
  id: UUIDSchema,
  organizationId: UUIDSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().nullable(),
  repositoryUrl: z.string().url().nullable(),
  defaultBranch: z.string().default('main'),
  settings: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  createdBy: UUIDSchema.nullable(),
  ...TimestampsSchema.shape,
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;

// ============================================
// Module
// ============================================

export const ModuleSchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  name: z.string().min(1).max(255),
  path: z.string().max(512).nullable(),
  description: z.string().nullable(),
  ownerId: UUIDSchema.nullable(),
  metadata: z.record(z.unknown()).default({}),
  ...TimestampsSchema.shape,
});

export type Module = z.infer<typeof ModuleSchema>;

export const CreateModuleSchema = ModuleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateModule = z.infer<typeof CreateModuleSchema>;

// ============================================
// Context Entry
// ============================================

export const ContextEntryTypeSchema = z.enum([
  'adr',
  'pattern',
  'knowledge',
  'troubleshooting',
  'context',
  'team',
  'module',
]);

export const ContextEntryStatusSchema = z.enum([
  'draft',
  'active',
  'deprecated',
  'superseded',
]);

export const ContentFormatSchema = z.enum(['markdown', 'json', 'yaml']);

export const ContextEntrySchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  moduleId: UUIDSchema.nullable(),

  type: ContextEntryTypeSchema,
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  contentFormat: ContentFormatSchema.default('markdown'),

  status: ContextEntryStatusSchema.default('active'),
  supersededBy: UUIDSchema.nullable(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),

  embedding: z.array(z.number()).length(1536).nullable(),

  version: z.number().int().positive().default(1),

  createdBy: UUIDSchema.nullable(),
  updatedBy: UUIDSchema.nullable(),
  ...TimestampsSchema.shape,
});

export type ContextEntry = z.infer<typeof ContextEntrySchema>;

export const CreateContextEntrySchema = ContextEntrySchema.omit({
  id: true,
  embedding: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateContextEntry = z.infer<typeof CreateContextEntrySchema>;

export const UpdateContextEntrySchema = CreateContextEntrySchema.partial().extend({
  id: UUIDSchema,
});

export type UpdateContextEntry = z.infer<typeof UpdateContextEntrySchema>;

// ============================================
// Context Relation
// ============================================

export const RelationTypeSchema = z.enum([
  'depends_on',
  'supersedes',
  'relates_to',
  'implements',
]);

export const ContextRelationSchema = z.object({
  id: UUIDSchema,
  sourceId: UUIDSchema,
  targetId: UUIDSchema,
  relationType: RelationTypeSchema,
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export type ContextRelation = z.infer<typeof ContextRelationSchema>;

// ============================================
// ADR (Architecture Decision Record)
// ============================================

export const ADRAlternativeSchema = z.object({
  title: z.string(),
  description: z.string(),
  rejectedReason: z.string().optional(),
});

export const ADRSchema = z.object({
  id: UUIDSchema,
  contextEntryId: UUIDSchema,
  adrNumber: z.number().int().positive(),
  decisionDate: z.date().nullable(),
  decisionMakers: z.array(z.string()).default([]),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  alternatives: z.array(ADRAlternativeSchema).default([]),
  consequences: z.string().nullable(),
  ...TimestampsSchema.shape,
});

export type ADR = z.infer<typeof ADRSchema>;

// ============================================
// Sync Event
// ============================================

export const SyncEventTypeSchema = z.enum(['create', 'update', 'delete']);

export const SyncEventSchema = z.object({
  id: UUIDSchema,
  projectId: UUIDSchema,
  entityType: z.string(),
  entityId: UUIDSchema,
  eventType: SyncEventTypeSchema,
  payload: z.record(z.unknown()),
  userId: UUIDSchema.nullable(),
  sequenceNumber: z.bigint(),
  createdAt: z.date(),
});

export type SyncEvent = z.infer<typeof SyncEventSchema>;

// ============================================
// Audit Log
// ============================================

export const AuditLogSchema = z.object({
  id: UUIDSchema,
  organizationId: UUIDSchema.nullable(),
  userId: UUIDSchema.nullable(),
  action: z.string().max(100),
  entityType: z.string().max(50),
  entityId: UUIDSchema.nullable(),
  changes: z.object({
    before: z.record(z.unknown()).nullable(),
    after: z.record(z.unknown()).nullable(),
  }).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============================================
// Search
// ============================================

export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  projectId: UUIDSchema,
  types: z.array(ContextEntryTypeSchema).optional(),
  tags: z.array(z.string()).optional(),
  moduleId: UUIDSchema.optional(),
  status: z.array(ContextEntryStatusSchema).optional(),
  createdBy: UUIDSchema.optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  updatedAfter: z.coerce.date().optional(),
  updatedBefore: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  semantic: z.boolean().default(true),
  minSimilarity: z.number().min(0).max(1).default(0.7),
  includeHighlights: z.boolean().default(true),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchHighlightSchema = z.object({
  field: z.enum(['title', 'content']),
  text: z.string(),
  matchedTerms: z.array(z.string()).default([]),
});

export type SearchHighlight = z.infer<typeof SearchHighlightSchema>;

export const SearchResultSchema = z.object({
  entry: ContextEntrySchema,
  similarity: z.number().nullable(),
  highlights: z.array(SearchHighlightSchema).default([]),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  query: z.string(),
  semantic: z.boolean(),
  total: z.number(),
  took: z.number(), // milliseconds
  cached: z.boolean().default(false),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ============================================
// API Response Types
// ============================================

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  });

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
