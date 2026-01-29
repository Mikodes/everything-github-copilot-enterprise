/**
 * US-012: Real-time Collaboration - Chat Provider
 *
 * Implements AC-012.3: Quick Chat
 * Provides contextual quick chat between users viewing the same context
 */

import * as vscode from 'vscode';
import {
  CollaborationService,
  getCollaborationService,
} from '../services/CollaborationService';
import {
  ChatMessage,
  TypingPayload,
  formatTimeAgo,
} from '../models/collaboration';

/**
 * Tree item representing a chat message
 */
export class ChatMessageTreeItem extends vscode.TreeItem {
  constructor(public readonly message: ChatMessage) {
    super('', vscode.TreeItemCollapsibleState.None);

    this.label = this.formatLabel();
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIconPath();
    this.contextValue = this.message.type === 'message' ? 'chatMessage' : 'systemMessage';
  }

  private formatLabel(): string {
    if (this.message.type === 'system') {
      return this.message.content;
    }
    return this.message.content.length > 50
      ? this.message.content.substring(0, 47) + '...'
      : this.message.content;
  }

  private getDescription(): string {
    if (this.message.type === 'system') {
      return formatTimeAgo(this.message.timestamp);
    }
    return `${this.message.userName} - ${formatTimeAgo(this.message.timestamp)}`;
  }

  private getTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();

    if (this.message.type === 'system') {
      md.appendMarkdown(`*${this.message.content}*`);
    } else {
      md.appendMarkdown(`**${this.message.userName}**\n\n`);
      md.appendMarkdown(this.message.content);

      if (this.message.contextFile) {
        const fileName = this.message.contextFile.split('/').pop();
        md.appendMarkdown(`\n\n---\n*Context: ${fileName}`);
        if (this.message.contextLine !== undefined) {
          md.appendMarkdown(`:${this.message.contextLine + 1}`);
        }
        md.appendMarkdown('*');
      }
    }

    md.appendMarkdown(`\n\n*${new Date(this.message.timestamp).toLocaleString()}*`);

    return md;
  }

  private getIconPath(): vscode.ThemeIcon {
    switch (this.message.type) {
      case 'system':
        return new vscode.ThemeIcon('info');
      case 'notification':
        return new vscode.ThemeIcon('bell');
      default:
        return new vscode.ThemeIcon('comment');
    }
  }
}

/**
 * Tree item for typing indicator
 */
export class TypingIndicatorTreeItem extends vscode.TreeItem {
  constructor(public readonly users: string[]) {
    super('', vscode.TreeItemCollapsibleState.None);

    this.label = this.formatLabel();
    this.iconPath = new vscode.ThemeIcon('loading~spin');
    this.contextValue = 'typingIndicator';
  }

  private formatLabel(): string {
    if (this.users.length === 1) {
      return `${this.users[0]} is typing...`;
    } else if (this.users.length === 2) {
      return `${this.users[0]} and ${this.users[1]} are typing...`;
    } else {
      return `${this.users.length} people are typing...`;
    }
  }
}

/**
 * Tree data provider for collaboration chat
 */
export class CollaborationChatProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private collaborationService: CollaborationService;
  private typingUsers: Map<string, string> = new Map(); // userId -> userName
  private typingTimeout: Map<string, NodeJS.Timeout> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.collaborationService = getCollaborationService();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for new messages
    this.disposables.push(
      this.collaborationService.onChatMessageReceived(() => {
        this.refresh();
      })
    );

    // Listen for typing indicators
    this.disposables.push(
      this.collaborationService.onTypingChanged((payload) => {
        this.handleTyping(payload);
      })
    );

    // Listen for user joined/left
    this.disposables.push(
      this.collaborationService.onUserJoined((presence) => {
        // Add system message for user joined
        this.refresh();
      })
    );

    this.disposables.push(
      this.collaborationService.onUserLeft((user) => {
        // Remove typing indicator if user was typing
        this.typingUsers.delete(user.id);
        this.refresh();
      })
    );
  }

  private handleTyping(payload: TypingPayload): void {
    // Clear existing timeout for this user
    const existingTimeout = this.typingTimeout.get(payload.userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Determine if this is typing start or stop based on message type
    // The payload comes from 'typing_start' or 'typing_stop' events
    const message = this.collaborationService as unknown as { lastTypingEvent?: string };

    // Add or update typing user
    this.typingUsers.set(payload.userId, payload.userName);

    // Set timeout to remove typing indicator after 3 seconds
    const timeout = setTimeout(() => {
      this.typingUsers.delete(payload.userId);
      this.typingTimeout.delete(payload.userId);
      this.refresh();
    }, 3000);

    this.typingTimeout.set(payload.userId, timeout);
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    const connectionState = this.collaborationService.getConnectionState();
    if (connectionState !== 'connected') {
      const item = new vscode.TreeItem('Connect to see chat');
      item.iconPath = new vscode.ThemeIcon('plug');
      item.command = {
        command: 'egce.startCollaboration',
        title: 'Connect',
      };
      return [item];
    }

    const items: vscode.TreeItem[] = [];

    // Add typing indicator if anyone is typing
    if (this.typingUsers.size > 0) {
      items.push(new TypingIndicatorTreeItem(Array.from(this.typingUsers.values())));
    }

    // Get messages (most recent first)
    const messages = this.collaborationService.getChatMessages();
    const recentMessages = messages.slice(-20).reverse();

    if (recentMessages.length === 0 && this.typingUsers.size === 0) {
      const item = new vscode.TreeItem('No messages yet');
      item.iconPath = new vscode.ThemeIcon('comment-discussion');
      item.description = 'Start a conversation!';
      return [item];
    }

    for (const message of recentMessages) {
      items.push(new ChatMessageTreeItem(message));
    }

    return items;
  }

  dispose(): void {
    // Clear all typing timeouts
    for (const timeout of this.typingTimeout.values()) {
      clearTimeout(timeout);
    }
    this.typingTimeout.clear();

    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeTreeData.dispose();
  }
}

/**
 * Chat panel for quick messages using a webview
 */
export class CollaborationChatPanel implements vscode.Disposable {
  public static currentPanel: CollaborationChatPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private collaborationService: CollaborationService;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.collaborationService = getCollaborationService();

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'sendMessage':
            this.sendMessage(message.content, message.contextFile, message.contextLine);
            return;
        }
      },
      null,
      this._disposables
    );

    // Listen for new messages
    this._disposables.push(
      this.collaborationService.onChatMessageReceived((message) => {
        this._panel.webview.postMessage({
          type: 'newMessage',
          message,
        });
      })
    );

    // Listen for typing
    this._disposables.push(
      this.collaborationService.onTypingChanged((payload) => {
        this._panel.webview.postMessage({
          type: 'typing',
          payload,
        });
      })
    );
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (CollaborationChatPanel.currentPanel) {
      CollaborationChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'collaborationChat',
      'Team Chat',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    CollaborationChatPanel.currentPanel = new CollaborationChatPanel(panel, extensionUri);
  }

  private sendMessage(content: string, contextFile?: string, contextLine?: number): void {
    this.collaborationService.sendChatMessage(content, contextFile, contextLine);
  }

  private _update(): void {
    const webview = this._panel.webview;
    this._panel.title = 'Team Chat';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const currentUser = this.collaborationService.getCurrentUser();
    const messages = this.collaborationService.getChatMessages();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Chat</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        .message {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 8px;
            background-color: var(--vscode-input-background);
        }
        .message.own {
            background-color: var(--vscode-button-background);
            margin-left: 20%;
        }
        .message.other {
            margin-right: 20%;
        }
        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 0.85em;
            opacity: 0.8;
        }
        .message-author {
            font-weight: bold;
        }
        .message-time {
            opacity: 0.7;
        }
        .message-content {
            word-wrap: break-word;
        }
        .message-context {
            font-size: 0.8em;
            opacity: 0.7;
            margin-top: 4px;
            font-style: italic;
        }
        .input-container {
            display: flex;
            padding: 10px;
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-input-background);
        }
        .input-container input {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            margin-right: 8px;
        }
        .input-container button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .input-container button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .typing-indicator {
            padding: 5px 10px;
            font-style: italic;
            opacity: 0.7;
            font-size: 0.9em;
        }
        .system-message {
            text-align: center;
            opacity: 0.7;
            font-style: italic;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="chat-container" id="chatContainer">
        ${messages
          .map(
            (msg) => `
            <div class="message ${msg.userId === currentUser?.id ? 'own' : 'other'}">
                <div class="message-header">
                    <span class="message-author">${msg.userName}</span>
                    <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="message-content">${this.escapeHtml(msg.content)}</div>
                ${
                  msg.contextFile
                    ? `<div class="message-context">
                    Re: ${msg.contextFile.split('/').pop()}${msg.contextLine !== undefined ? ':' + (msg.contextLine + 1) : ''}
                </div>`
                    : ''
                }
            </div>
        `
          )
          .join('')}
    </div>
    <div class="typing-indicator" id="typingIndicator" style="display: none;"></div>
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Type a message..." />
        <button onclick="sendMessage()">Send</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const typingIndicator = document.getElementById('typingIndicator');
        const currentUserId = ${JSON.stringify(currentUser?.id)};
        const typingUsers = new Map();

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Send message on Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        function sendMessage() {
            const content = messageInput.value.trim();
            if (content) {
                vscode.postMessage({
                    command: 'sendMessage',
                    content: content
                });
                messageInput.value = '';
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString();
        }

        function addMessage(message) {
            const isOwn = message.userId === currentUserId;
            const div = document.createElement('div');
            div.className = 'message ' + (isOwn ? 'own' : 'other');
            div.innerHTML = \`
                <div class="message-header">
                    <span class="message-author">\${escapeHtml(message.userName)}</span>
                    <span class="message-time">\${formatTime(message.timestamp)}</span>
                </div>
                <div class="message-content">\${escapeHtml(message.content)}</div>
                \${message.contextFile ? \`
                    <div class="message-context">
                        Re: \${message.contextFile.split('/').pop()}\${message.contextLine !== undefined ? ':' + (message.contextLine + 1) : ''}
                    </div>
                \` : ''}
            \`;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function updateTypingIndicator() {
            if (typingUsers.size === 0) {
                typingIndicator.style.display = 'none';
            } else {
                const names = Array.from(typingUsers.values());
                let text;
                if (names.length === 1) {
                    text = names[0] + ' is typing...';
                } else if (names.length === 2) {
                    text = names[0] + ' and ' + names[1] + ' are typing...';
                } else {
                    text = names.length + ' people are typing...';
                }
                typingIndicator.textContent = text;
                typingIndicator.style.display = 'block';
            }
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const data = event.data;
            switch (data.type) {
                case 'newMessage':
                    addMessage(data.message);
                    break;
                case 'typing':
                    if (data.payload.userId !== currentUserId) {
                        typingUsers.set(data.payload.userId, data.payload.userName);
                        updateTypingIndicator();
                        // Remove after 3 seconds
                        setTimeout(() => {
                            typingUsers.delete(data.payload.userId);
                            updateTypingIndicator();
                        }, 3000);
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose(): void {
    CollaborationChatPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

/**
 * Quick input for sending a chat message
 */
export async function showQuickChatInput(): Promise<void> {
  const collaborationService = getCollaborationService();

  if (collaborationService.getConnectionState() !== 'connected') {
    const action = await vscode.window.showWarningMessage(
      'Not connected to collaboration. Connect now?',
      'Connect',
      'Cancel'
    );
    if (action === 'Connect') {
      await collaborationService.connect();
    }
    return;
  }

  const activeEditor = vscode.window.activeTextEditor;
  const contextFile = activeEditor?.document.uri.fsPath;
  const contextLine = activeEditor?.selection.active.line;

  const message = await vscode.window.showInputBox({
    prompt: 'Send a message to your team',
    placeHolder: 'Type your message...',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Message cannot be empty';
      }
      return null;
    },
  });

  if (message) {
    collaborationService.sendChatMessage(message, contextFile, contextLine);
    vscode.window.showInformationMessage('Message sent!');
  }
}

/**
 * Register collaboration chat provider
 */
export function registerCollaborationChatProvider(
  context: vscode.ExtensionContext
): CollaborationChatProvider {
  const provider = new CollaborationChatProvider();

  // Register tree view
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('memoryBankChat', provider)
  );

  context.subscriptions.push(provider);

  return provider;
}
