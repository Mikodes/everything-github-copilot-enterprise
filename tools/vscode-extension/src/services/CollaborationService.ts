/**
 * US-012: Real-time Collaboration Service
 * Manages WebSocket connections, presence tracking, cursor sharing, and chat
 *
 * Implements:
 * - AC-012.1: User Presence (avatars of users viewing same file)
 * - AC-012.2: Cursor Tracking (optional cursor indicators)
 * - AC-012.3: Quick Chat (contextual chat between users)
 * - AC-012.4: Permissions (respects team roles)
 * - AC-012.5: WebSocket Integration (works over WebSocket from US-002)
 */

import * as vscode from 'vscode';
import {
  UserPresence,
  UserInfo,
  CursorPosition,
  SelectionRange,
  ChatMessage,
  CollaborationMessage,
  CollaborationMessageType,
  PresenceStatus,
  ConnectionState,
  CollaborationConfig,
  SubscribePayload,
  PresenceUpdatePayload,
  PresenceChangedPayload,
  CursorUpdatePayload,
  CursorChangedPayload,
  SelectionUpdatePayload,
  SelectionChangedPayload,
  ChatMessagePayload,
  ChatReceivedPayload,
  TypingPayload,
  getUserColor,
  generateMessageId,
  Collaborator,
  toCollaborator,
} from '../models/collaboration';

/**
 * Event types emitted by CollaborationService
 */
export interface CollaborationEvents {
  onConnectionStateChanged: vscode.Event<ConnectionState>;
  onPresenceChanged: vscode.Event<UserPresence[]>;
  onCursorChanged: vscode.Event<CursorChangedPayload>;
  onSelectionChanged: vscode.Event<SelectionChangedPayload>;
  onChatMessageReceived: vscode.Event<ChatMessage>;
  onTypingChanged: vscode.Event<TypingPayload>;
  onUserJoined: vscode.Event<UserPresence>;
  onUserLeft: vscode.Event<UserInfo>;
  onError: vscode.Event<Error>;
}

/**
 * Service for managing real-time collaboration features
 */
export class CollaborationService implements vscode.Disposable {
  private socket: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private config: CollaborationConfig;
  private projectId: string;
  private currentUser: UserInfo | null = null;
  private presences: Map<string, UserPresence> = new Map();
  private chatMessages: ChatMessage[] = [];
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cursorUpdateTimeout: NodeJS.Timeout | null = null;
  private presenceUpdateInterval: NodeJS.Timeout | null = null;
  private lastCursorPosition: CursorPosition | null = null;
  private lastSelection: SelectionRange | null = null;
  private lastFile: string | null = null;
  private disposables: vscode.Disposable[] = [];

  // Event emitters
  private readonly _onConnectionStateChanged = new vscode.EventEmitter<ConnectionState>();
  private readonly _onPresenceChanged = new vscode.EventEmitter<UserPresence[]>();
  private readonly _onCursorChanged = new vscode.EventEmitter<CursorChangedPayload>();
  private readonly _onSelectionChanged = new vscode.EventEmitter<SelectionChangedPayload>();
  private readonly _onChatMessageReceived = new vscode.EventEmitter<ChatMessage>();
  private readonly _onTypingChanged = new vscode.EventEmitter<TypingPayload>();
  private readonly _onUserJoined = new vscode.EventEmitter<UserPresence>();
  private readonly _onUserLeft = new vscode.EventEmitter<UserInfo>();
  private readonly _onError = new vscode.EventEmitter<Error>();

  // Public events
  public readonly onConnectionStateChanged = this._onConnectionStateChanged.event;
  public readonly onPresenceChanged = this._onPresenceChanged.event;
  public readonly onCursorChanged = this._onCursorChanged.event;
  public readonly onSelectionChanged = this._onSelectionChanged.event;
  public readonly onChatMessageReceived = this._onChatMessageReceived.event;
  public readonly onTypingChanged = this._onTypingChanged.event;
  public readonly onUserJoined = this._onUserJoined.event;
  public readonly onUserLeft = this._onUserLeft.event;
  public readonly onError = this._onError.event;

  constructor() {
    this.config = this.loadConfig();
    this.projectId = this.getProjectId();
    this.setupEventListeners();
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): CollaborationConfig {
    const vsConfig = vscode.workspace.getConfiguration('egce.collaboration');
    return {
      enabled: vsConfig.get<boolean>('enabled', true),
      showPresence: vsConfig.get<boolean>('showPresence', true),
      showCursors: vsConfig.get<boolean>('showCursors', true),
      showSelections: vsConfig.get<boolean>('showSelections', true),
      enableChat: vsConfig.get<boolean>('enableChat', true),
      cursorUpdateDebounceMs: vsConfig.get<number>('cursorUpdateDebounceMs', 100),
      presenceUpdateIntervalMs: vsConfig.get<number>('presenceUpdateIntervalMs', 30000),
      reconnectAttempts: vsConfig.get<number>('reconnectAttempts', 5),
      reconnectBackoffMs: vsConfig.get<number>('reconnectBackoffMs', 1000),
    };
  }

  /**
   * Get project ID from workspace
   */
  private getProjectId(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    return 'default-project';
  }

  /**
   * Setup VS Code event listeners
   */
  private setupEventListeners(): void {
    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.connectionState === 'connected') {
          this.updatePresence({
            currentFile: editor.document.uri.fsPath,
            status: 'viewing',
          });
        }
      })
    );

    // Listen for cursor position changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (this.connectionState === 'connected' && this.config.showCursors) {
          this.debouncedCursorUpdate(event);
        }
      })
    );

    // Listen for document changes (typing)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.connectionState === 'connected' && event.contentChanges.length > 0) {
          this.updatePresence({ status: 'editing' });
          this.sendTypingIndicator(true);
        }
      })
    );

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('egce.collaboration')) {
          this.config = this.loadConfig();
          if (!this.config.enabled && this.connectionState === 'connected') {
            this.disconnect();
          }
        }
      })
    );
  }

  /**
   * Connect to the collaboration WebSocket server
   */
  async connect(user?: UserInfo): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    if (!this.config.enabled) {
      console.log('Collaboration is disabled in settings');
      return;
    }

    // Get or create user info
    this.currentUser = user ?? await this.getCurrentUser();
    if (!this.currentUser) {
      throw new Error('Unable to get current user information');
    }

    this.setConnectionState('connecting');

    try {
      const wsUrl = this.getWebSocketUrl();
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => this.handleOpen();
      this.socket.onmessage = (event) => this.handleMessage(event);
      this.socket.onclose = (event) => this.handleClose(event);
      this.socket.onerror = (event) => this.handleError(event);
    } catch (error) {
      this.setConnectionState('error');
      this._onError.fire(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the collaboration server
   */
  disconnect(): void {
    this.clearTimers();

    if (this.socket) {
      // Send unsubscribe before closing
      if (this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage('unsubscribe', { projectId: this.projectId });
      }
      this.socket.close();
      this.socket = null;
    }

    this.presences.clear();
    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Get the WebSocket URL from configuration
   */
  private getWebSocketUrl(): string {
    const config = vscode.workspace.getConfiguration('egce');
    const baseUrl = config.get<string>('memoryServiceUrl', 'http://localhost:3000');
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}/ws/sync`;
  }

  /**
   * Get current user information
   */
  private async getCurrentUser(): Promise<UserInfo | null> {
    try {
      // Try to get user info from Git
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        const git = gitExtension.exports.getAPI(1);
        const repo = git.repositories[0];
        if (repo) {
          const config = await repo.getConfigs();
          const name = config.find((c: { key: string }) => c.key === 'user.name')?.value;
          const email = config.find((c: { key: string }) => c.key === 'user.email')?.value;

          if (name && email) {
            return {
              id: email,
              name,
              email,
              avatarUrl: `https://www.gravatar.com/avatar/${this.hashEmail(email)}?d=identicon`,
            };
          }
        }
      }
    } catch (error) {
      console.warn('Could not get user info from Git:', error);
    }

    // Fallback to VS Code identity or anonymous
    const machineId = vscode.env.machineId;
    return {
      id: machineId,
      name: 'Anonymous User',
      email: undefined,
      avatarUrl: undefined,
    };
  }

  /**
   * Simple hash for Gravatar
   */
  private hashEmail(email: string): string {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('Collaboration WebSocket connected');
    this.setConnectionState('connected');
    this.reconnectAttempts = 0;

    // Subscribe to project
    const payload: SubscribePayload = {
      projectId: this.projectId,
      userId: this.currentUser!.id,
      userName: this.currentUser!.name,
      userAvatarUrl: this.currentUser!.avatarUrl,
    };
    this.sendMessage('subscribe', payload);

    // Start heartbeat
    this.startHeartbeat();

    // Start presence updates
    this.startPresenceUpdates();

    // Send initial presence
    const activeEditor = vscode.window.activeTextEditor;
    this.updatePresence({
      status: 'online',
      currentFile: activeEditor?.document.uri.fsPath ?? null,
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: CollaborationMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'connected':
          console.log('Collaboration subscription confirmed');
          break;

        case 'presence_changed':
          this.handlePresenceChanged(message.payload as PresenceChangedPayload);
          break;

        case 'cursor_changed':
          this.handleCursorChanged(message.payload as CursorChangedPayload);
          break;

        case 'selection_changed':
          this.handleSelectionChanged(message.payload as SelectionChangedPayload);
          break;

        case 'chat_received':
          this.handleChatReceived(message.payload as ChatReceivedPayload);
          break;

        case 'typing_start':
        case 'typing_stop':
          this._onTypingChanged.fire(message.payload as TypingPayload);
          break;

        case 'user_joined':
          this.handleUserJoined(message.payload as UserPresence);
          break;

        case 'user_left':
          this.handleUserLeft(message.payload as UserInfo);
          break;

        case 'error':
          console.error('Collaboration error:', message.payload);
          break;

        case 'heartbeat':
          // Server heartbeat received, connection is alive
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing collaboration message:', error);
    }
  }

  /**
   * Handle presence changed event
   */
  private handlePresenceChanged(payload: PresenceChangedPayload): void {
    if (payload.action === 'updated' || payload.action === 'joined') {
      this.presences.set(payload.userId, payload.presence);
    } else if (payload.action === 'left') {
      this.presences.delete(payload.userId);
    }

    // Update all presences if provided
    if (payload.allPresences) {
      this.presences.clear();
      for (const presence of payload.allPresences) {
        if (presence.user.id !== this.currentUser?.id) {
          this.presences.set(presence.user.id, presence);
        }
      }
    }

    this._onPresenceChanged.fire(Array.from(this.presences.values()));
  }

  /**
   * Handle cursor changed event
   */
  private handleCursorChanged(payload: CursorChangedPayload): void {
    if (payload.userId !== this.currentUser?.id) {
      this._onCursorChanged.fire(payload);
    }
  }

  /**
   * Handle selection changed event
   */
  private handleSelectionChanged(payload: SelectionChangedPayload): void {
    if (payload.userId !== this.currentUser?.id) {
      this._onSelectionChanged.fire(payload);
    }
  }

  /**
   * Handle chat message received
   */
  private handleChatReceived(payload: ChatReceivedPayload): void {
    this.chatMessages.push(payload.message);
    // Keep only last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages = this.chatMessages.slice(-100);
    }
    this._onChatMessageReceived.fire(payload.message);
  }

  /**
   * Handle user joined event
   */
  private handleUserJoined(presence: UserPresence): void {
    this.presences.set(presence.user.id, presence);
    this._onUserJoined.fire(presence);
    this._onPresenceChanged.fire(Array.from(this.presences.values()));
  }

  /**
   * Handle user left event
   */
  private handleUserLeft(user: UserInfo): void {
    this.presences.delete(user.id);
    this._onUserLeft.fire(user);
    this._onPresenceChanged.fire(Array.from(this.presences.values()));
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('Collaboration WebSocket closed:', event.code, event.reason);
    this.clearTimers();

    if (this.connectionState !== 'disconnected') {
      this.setConnectionState('disconnected');
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('Collaboration WebSocket error:', event);
    this._onError.fire(new Error('WebSocket connection error'));
    this.setConnectionState('error');
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectBackoffMs * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.setConnectionState('reconnecting');

    this.reconnectTimeout = setTimeout(() => {
      this.connect(this.currentUser ?? undefined);
    }, delay);
  }

  /**
   * Send a message through WebSocket
   */
  private sendMessage(type: CollaborationMessageType, payload: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }

    const message: CollaborationMessage = {
      id: generateMessageId(),
      type,
      timestamp: Date.now(),
      payload,
    };

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Update presence state
   */
  updatePresence(update: Partial<PresenceUpdatePayload>): void {
    if (this.connectionState !== 'connected') return;

    const payload: PresenceUpdatePayload = {
      status: update.status ?? 'online',
      currentFile: update.currentFile ?? this.lastFile,
      currentModule: update.currentModule ?? null,
      cursorPosition: update.cursorPosition ?? this.lastCursorPosition,
      selection: update.selection ?? this.lastSelection,
    };

    this.lastFile = payload.currentFile;
    this.sendMessage('presence_update', payload);
  }

  /**
   * Debounced cursor update
   */
  private debouncedCursorUpdate(event: vscode.TextEditorSelectionChangeEvent): void {
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
    }

    this.cursorUpdateTimeout = setTimeout(() => {
      const editor = event.textEditor;
      const selection = event.selections[0];

      const cursorPosition: CursorPosition = {
        line: selection.active.line,
        column: selection.active.character,
      };

      // Send cursor update
      const cursorPayload: CursorUpdatePayload = {
        file: editor.document.uri.fsPath,
        position: cursorPosition,
      };
      this.sendMessage('cursor_update', cursorPayload);
      this.lastCursorPosition = cursorPosition;

      // Send selection update if there's a selection
      if (!selection.isEmpty && this.config.showSelections) {
        const selectionRange: SelectionRange = {
          start: { line: selection.start.line, column: selection.start.character },
          end: { line: selection.end.line, column: selection.end.character },
        };
        const selectionPayload: SelectionUpdatePayload = {
          file: editor.document.uri.fsPath,
          selection: selectionRange,
        };
        this.sendMessage('selection_update', selectionPayload);
        this.lastSelection = selectionRange;
      } else if (this.lastSelection) {
        // Clear selection
        const selectionPayload: SelectionUpdatePayload = {
          file: editor.document.uri.fsPath,
          selection: null,
        };
        this.sendMessage('selection_update', selectionPayload);
        this.lastSelection = null;
      }
    }, this.config.cursorUpdateDebounceMs);
  }

  /**
   * Send typing indicator
   */
  private typingTimeout: NodeJS.Timeout | null = null;
  private isTyping = false;

  private sendTypingIndicator(typing: boolean): void {
    if (!this.config.enableChat) return;

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

    if (typing && !this.isTyping) {
      this.isTyping = true;
      this.sendMessage('typing_start', {
        userId: this.currentUser?.id,
        userName: this.currentUser?.name,
        file: activeEditor.document.uri.fsPath,
      });
    }

    // Clear typing indicator after 2 seconds of no activity
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false;
        this.sendMessage('typing_stop', {
          userId: this.currentUser?.id,
          userName: this.currentUser?.name,
          file: activeEditor.document.uri.fsPath,
        });
      }
    }, 2000);
  }

  /**
   * Send a chat message (AC-012.3: Quick Chat)
   */
  sendChatMessage(content: string, contextFile?: string, contextLine?: number): void {
    if (!this.config.enableChat || this.connectionState !== 'connected') {
      console.warn('Cannot send chat: not connected or chat disabled');
      return;
    }

    const payload: ChatMessagePayload = {
      content,
      contextFile,
      contextLine,
    };

    this.sendMessage('chat_message', payload);
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendMessage('heartbeat', { timestamp: Date.now() });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Start periodic presence updates
   */
  private startPresenceUpdates(): void {
    this.presenceUpdateInterval = setInterval(() => {
      this.updatePresence({});
    }, this.config.presenceUpdateIntervalMs);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
      this.presenceUpdateInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
      this.cursorUpdateTimeout = null;
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  /**
   * Set and emit connection state
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this._onConnectionStateChanged.fire(state);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current user
   */
  getCurrentUser(): UserInfo | null {
    return this.currentUser;
  }

  /**
   * Get all collaborators (other users)
   */
  getCollaborators(): Collaborator[] {
    return Array.from(this.presences.values())
      .filter(p => p.user.id !== this.currentUser?.id)
      .map(toCollaborator);
  }

  /**
   * Get collaborators viewing a specific file
   */
  getCollaboratorsInFile(filePath: string): Collaborator[] {
    return this.getCollaborators()
      .filter(c => c.currentFile === filePath);
  }

  /**
   * Get chat messages
   */
  getChatMessages(): ChatMessage[] {
    return [...this.chatMessages];
  }

  /**
   * Get chat messages for a specific file context
   */
  getChatMessagesForFile(filePath: string): ChatMessage[] {
    return this.chatMessages.filter(m => m.contextFile === filePath);
  }

  /**
   * Check if collaboration is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.disconnect();
    this.disposables.forEach(d => d.dispose());
    this._onConnectionStateChanged.dispose();
    this._onPresenceChanged.dispose();
    this._onCursorChanged.dispose();
    this._onSelectionChanged.dispose();
    this._onChatMessageReceived.dispose();
    this._onTypingChanged.dispose();
    this._onUserJoined.dispose();
    this._onUserLeft.dispose();
    this._onError.dispose();
  }
}

// Singleton instance
let collaborationService: CollaborationService | null = null;

/**
 * Get the collaboration service singleton
 */
export function getCollaborationService(): CollaborationService {
  if (!collaborationService) {
    collaborationService = new CollaborationService();
  }
  return collaborationService;
}

/**
 * Reset the collaboration service (for testing)
 */
export function resetCollaborationService(): void {
  if (collaborationService) {
    collaborationService.dispose();
    collaborationService = null;
  }
}
