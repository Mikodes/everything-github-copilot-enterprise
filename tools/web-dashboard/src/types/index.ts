// Memory Bank Types
export interface ProjectContext {
  id: string;
  name: string;
  description: string;
  version: string;
  repository: string;
  techStack: string[];
  architecture: string;
  team: TeamMember[];
  modules: ModuleContext[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamContext {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  roles: TeamRole[];
  communication: CommunicationChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  githubUsername?: string;
  expertise?: string[];
}

export interface TeamRole {
  name: string;
  description: string;
  permissions: string[];
}

export interface CommunicationChannel {
  name: string;
  type: 'slack' | 'teams' | 'discord' | 'email' | 'other';
  url?: string;
}

export interface ModuleContext {
  id: string;
  name: string;
  description: string;
  path: string;
  owner?: string;
  dependencies: string[];
  technologies: string[];
  patterns: string[];
  createdAt: string;
  updatedAt: string;
}

// Decision Record (ADR) Types
export interface DecisionRecord {
  id: string;
  title: string;
  status: ADRStatus;
  context: string;
  decision: string;
  consequences: string[];
  alternatives?: Alternative[];
  relatedDecisions?: string[];
  author: string;
  date: string;
  updatedAt?: string;
  tags?: string[];
}

export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded' | 'rejected';

export interface Alternative {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
}

// Knowledge Entry Types
export interface KnowledgeEntry {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  relatedEntries?: string[];
}

export type KnowledgeCategory =
  | 'pattern'
  | 'best-practice'
  | 'troubleshooting'
  | 'tutorial'
  | 'reference'
  | 'faq'
  | 'other';

// Session Context Types
export interface SessionContext {
  id: string;
  userId: string;
  projectId: string;
  currentTask?: string;
  recentFiles: string[];
  openDecisions: string[];
  notes: string;
  startedAt: string;
  lastActivity: string;
}

// Activity Types
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  user: TeamMember;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | 'decision_created'
  | 'decision_updated'
  | 'decision_accepted'
  | 'knowledge_added'
  | 'knowledge_updated'
  | 'module_created'
  | 'context_updated'
  | 'member_joined'
  | 'review_completed'
  | 'commit_pushed';

// Memory Bank Tree Types
export interface MemoryBankNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: MemoryBankNode[];
  content?: string;
  metadata?: {
    fileType?: 'context' | 'decision' | 'knowledge' | 'template' | 'schema';
    lastModified?: string;
    size?: number;
  };
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// GitHub Types
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  visibility: 'public' | 'private';
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  html_url: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalDecisions: number;
  acceptedDecisions: number;
  pendingDecisions: number;
  totalKnowledge: number;
  teamMembers: number;
  modules: number;
  recentActivity: Activity[];
}
