/**
 * WebSocket Service
 *
 * Manages real-time WebSocket connection to the backend server.
 * Handles:
 * - Automatic connection with JWT authentication
 * - Reconnection with exponential backoff
 * - Family room joining for scoped messages
 * - Message routing to registered handlers
 * - Automatic notification creation for events
 *
 * @module services/websocket.service
 *
 * @example
 * ```typescript
 * import { websocketService } from './services/websocket.service';
 *
 * // Connect (usually done in Layout component)
 * websocketService.connect();
 *
 * // Subscribe to events
 * const unsubscribe = websocketService.on('story:created', (data) => {
 *   console.log('New story:', data.story);
 * });
 *
 * // Send presence update
 * websocketService.setPresence('away');
 *
 * // Clean up
 * unsubscribe();
 * websocketService.disconnect();
 * ```
 */

import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Types of WebSocket messages received from the server.
 *
 * - `member:online` - A family member came online
 * - `member:offline` - A family member went offline
 * - `member:presence` - A family member's presence status changed
 * - `member:typing` - A family member is typing a story
 * - `reminder` - An event reminder notification
 * - `agent:suggestion` - A proactive AI suggestion
 * - `story:created` - A new story was shared in the family
 */
type MessageType =
  | 'member:online'
  | 'member:offline'
  | 'member:presence'
  | 'member:typing'
  | 'reminder'
  | 'agent:suggestion'
  | 'story:created';

interface WebSocketMessage {
  type: MessageType;
  [key: string]: unknown;
}

type MessageHandler = (data: WebSocketMessage) => void;

/**
 * WebSocketService manages the WebSocket connection lifecycle.
 *
 * Features:
 * - Singleton pattern (use exported `websocketService` instance)
 * - Automatic reconnection with exponential backoff
 * - Event-based message handling with subscribe/unsubscribe
 * - Automatic notification creation for key events
 */
class WebSocketService {
  /** Active WebSocket connection */
  private ws: WebSocket | null = null;

  /** Current reconnection attempt count */
  private reconnectAttempts = 0;

  /** Maximum reconnection attempts before giving up */
  private maxReconnectAttempts = 5;

  /** Base delay for reconnection (doubles with each attempt) */
  private reconnectDelay = 1000;

  /** Registered message handlers by type */
  private handlers: Map<MessageType, Set<MessageHandler>> = new Map();

  /** Flag to prevent multiple simultaneous connection attempts */
  private isConnecting = false;

  /**
   * Establishes WebSocket connection to the server.
   *
   * Automatically:
   * - Gets JWT token from auth store
   * - Connects to WebSocket endpoint with token
   * - Joins family room after connection
   * - Sets up reconnection on disconnect
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('Cannot connect WebSocket: No auth token');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:6100/ws';
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`${wsUrl}?token=${token}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Join family room
        const user = useAuthStore.getState().user;
        if (user?.familyId) {
          this.send({ type: 'join', familyId: user.familyId });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;

        // Attempt reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), delay);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User logout');
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  // Send presence update
  setPresence(status: 'online' | 'away' | 'busy'): void {
    this.send({ type: 'presence', status });
  }

  // Send typing indicator
  sendTyping(storyId: string): void {
    this.send({ type: 'typing', storyId });
  }

  // Subscribe to message types
  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  // Unsubscribe from message type
  off(type: MessageType, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Default handlers for notifications
    switch (message.type) {
      case 'reminder':
        useNotificationStore.getState().addNotification({
          type: 'reminder',
          title: 'Event Reminder',
          message: message.message as string,
        });
        break;

      case 'agent:suggestion':
        useNotificationStore.getState().addNotification({
          type: 'suggestion',
          title: 'Rememberkin Suggestion',
          message: message.message as string,
        });
        break;

      case 'story:created':
        useNotificationStore.getState().addNotification({
          type: 'story',
          title: 'New Story',
          message: 'A new family story has been shared!',
        });
        break;
    }
  }
}

export const websocketService = new WebSocketService();
