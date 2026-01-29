/**
 * US-012: Real-time Collaboration Models
 * Data types for presence awareness, cursor tracking, and contextual chat
 */

/**
 * User presence status
 */
export type PresenceStatus = 'online' | 'editing' | 'viewing' | 'idle' | 'offline';

/**
 * Cursor position in a document
 */
export interface CursorPosition {
  line: number;
  column: number;
}

/**
 * Text selection range
 */
export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

/**
 * User identity information
 */
export interface UserInfo {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * User presence state (AC-012.1: User Presence)
 */
export interface UserPresence {
  user: UserInfo;
  status: PresenceStatus;
  currentFile: string | null;
  currentModule: string | null;
  cursorPosition: CursorPosition | null;
  selection: SelectionRange | null;
  color: string;
  lastActivity: number;
  isTyping: boolean;
}

/**
 * Collaborator with display information
 */
export interface Collaborator extends UserPresence {
  displayColor: string;
  displayLabel: string;
  timeAgo: string;
}

/**
 * Chat message for contextual quick chat (AC-012.3)
 */
export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  contextFile?: string;
  contextLine?: number;
  timestamp: number;
  type: 'message' | 'system' | 'notification';
}

/**
 * Chat room for file-based collaboration
 */
export interface ChatRoom {
  id: string;
  projectId: string;
  contextFile: string | null;
  participants: UserInfo[];
  messages: ChatMessage[];
  createdAt: number;
}

/**
 * WebSocket message types for collaboration
 */
export type CollaborationMessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'presence_update'
  | 'presence_changed'
  | 'cursor_update'
  | 'cursor_changed'
  | 'selection_update'
  | 'selection_changed'
  | 'chat_message'
  | 'chat_received'
  | 'typing_start'
  | 'typing_stop'
  | 'error'
  | 'heartbeat'
  | 'connected'
  | 'user_joined'
  | 'user_left';

/**
 * Base WebSocket message structure
 */
export interface CollaborationMessage {
  id: string;
  type: CollaborationMessageType;
  timestamp: number;
  correlationId?: string;
  payload: unknown;
}

/**
 * Subscribe to project collaboration
 */
export interface SubscribePayload {
  projectId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
}

/**
 * Presence update from client
 */
export interface PresenceUpdatePayload {
  status: PresenceStatus;
  currentFile: string | null;
  currentModule: string | null;
  cursorPosition: CursorPosition | null;
  selection: SelectionRange | null;
}

/**
 * Presence changed broadcast
 */
export interface PresenceChangedPayload {
  userId: string;
  action: 'joined' | 'left' | 'updated';
  presence: UserPresence;
  allPresences: UserPresence[];
}

/**
 * Cursor update from client
 */
export interface CursorUpdatePayload {
  file: string;
  position: CursorPosition;
}

/**
 * Cursor changed broadcast
 */
export interface CursorChangedPayload {
  userId: string;
  userName: string;
  color: string;
  file: string;
  position: CursorPosition;
}

/**
 * Selection update from client
 */
export interface SelectionUpdatePayload {
  file: string;
  selection: SelectionRange | null;
}

/**
 * Selection changed broadcast
 */
export interface SelectionChangedPayload {
  userId: string;
  userName: string;
  color: string;
  file: string;
  selection: SelectionRange | null;
}

/**
 * Chat message payload
 */
export interface ChatMessagePayload {
  content: string;
  contextFile?: string;
  contextLine?: number;
}

/**
 * Chat received broadcast
 */
export interface ChatReceivedPayload {
  message: ChatMessage;
}

/**
 * Typing indicator payload
 */
export interface TypingPayload {
  userId: string;
  userName: string;
  file: string;
}

/**
 * Error payload
 */
export interface ErrorPayload {
  code: string;
  message: string;
}

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Collaboration configuration options
 */
export interface CollaborationConfig {
  enabled: boolean;
  showPresence: boolean;
  showCursors: boolean;
  showSelections: boolean;
  enableChat: boolean;
  cursorUpdateDebounceMs: number;
  presenceUpdateIntervalMs: number;
  reconnectAttempts: number;
  reconnectBackoffMs: number;
}

/**
 * Generate a unique color for a user based on their ID
 */
export function getUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Gold
    '#BB8FCE', // Purple
    '#85C1E9', // Sky Blue
    '#F8B500', // Amber
    '#58D68D', // Emerald
  ];

  // Hash the userId to get a consistent index
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format time ago string
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 120) return '1 min ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 7200) return '1 hour ago';
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return 'more than a day ago';
}

/**
 * Create a Collaborator from UserPresence
 */
export function toCollaborator(presence: UserPresence): Collaborator {
  return {
    ...presence,
    displayColor: presence.color,
    displayLabel: presence.user.name.charAt(0).toUpperCase(),
    timeAgo: formatTimeAgo(presence.lastActivity),
  };
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
