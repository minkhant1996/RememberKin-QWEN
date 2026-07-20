import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthUser } from '../middleware/auth.middleware.js';
import { logger } from '../utils/logger.js';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  familyId?: string;
  isAlive?: boolean;
}

export class WebSocketHandler {
  static instance: WebSocketHandler | null = null;

  private clients: Map<string, Set<ExtendedWebSocket>> = new Map(); // familyId -> clients

  constructor(private wss: WebSocketServer) {
    WebSocketHandler.instance = this;
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat to detect dead connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const extWs = ws as ExtendedWebSocket;
        if (extWs.isAlive === false) {
          return ws.terminate();
        }
        extWs.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private handleConnection(ws: ExtendedWebSocket, req: IncomingMessage): void {
    // Authenticate from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as AuthUser;
      ws.userId = decoded.id;
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      logger.debug(`WebSocket connected: user ${ws.userId}`);
    } catch (error) {
      ws.close(4001, 'Invalid token');
    }
  }

  private handleMessage(ws: ExtendedWebSocket, data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'join':
          this.handleJoin(ws, message.familyId);
          break;

        case 'presence':
          this.handlePresence(ws, message.status);
          break;

        case 'typing':
          this.handleTyping(ws, message.storyId);
          break;

        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message:', error);
    }
  }

  private handleJoin(ws: ExtendedWebSocket, familyId: string): void {
    ws.familyId = familyId;

    if (!this.clients.has(familyId)) {
      this.clients.set(familyId, new Set());
    }
    this.clients.get(familyId)!.add(ws);

    // Notify others
    this.broadcastToFamily(familyId, {
      type: 'member:online',
      memberId: ws.userId,
    }, ws);

    logger.debug(`User ${ws.userId} joined family ${familyId}`);
  }

  private handlePresence(ws: ExtendedWebSocket, status: string): void {
    if (ws.familyId) {
      this.broadcastToFamily(ws.familyId, {
        type: 'member:presence',
        memberId: ws.userId,
        status,
      }, ws);
    }
  }

  private handleTyping(ws: ExtendedWebSocket, storyId: string): void {
    if (ws.familyId) {
      this.broadcastToFamily(ws.familyId, {
        type: 'member:typing',
        memberId: ws.userId,
        storyId,
      }, ws);
    }
  }

  private handleDisconnect(ws: ExtendedWebSocket): void {
    if (ws.familyId) {
      const familyClients = this.clients.get(ws.familyId);
      if (familyClients) {
        familyClients.delete(ws);
        if (familyClients.size === 0) {
          this.clients.delete(ws.familyId);
        }
      }

      this.broadcastToFamily(ws.familyId, {
        type: 'member:offline',
        memberId: ws.userId,
      });
    }

    logger.debug(`WebSocket disconnected: user ${ws.userId}`);
  }

  // Public methods for sending messages

  sendToUser(userId: string, message: object): void {
    this.wss.clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.userId === userId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  broadcastToFamily(familyId: string, message: object, exclude?: ExtendedWebSocket): void {
    const familyClients = this.clients.get(familyId);
    if (!familyClients) return;

    const data = JSON.stringify(message);
    familyClients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Send event reminder
  sendReminder(familyId: string, event: object, message: string): void {
    this.broadcastToFamily(familyId, {
      type: 'reminder',
      event,
      message,
    });
  }

  // Send proactive agent suggestion
  sendAgentSuggestion(userId: string, message: string): void {
    this.sendToUser(userId, {
      type: 'agent:suggestion',
      message,
    });
  }

  // Notify about new story
  notifyNewStory(familyId: string, story: object): void {
    this.broadcastToFamily(familyId, {
      type: 'story:created',
      story,
    });
  }
}
