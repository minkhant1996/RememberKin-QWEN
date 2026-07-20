import api from './api';
import { useAuthStore } from '../store/authStore';
import { ChatResponse, ChatMessage, UsageInfo } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface ChatResponseWithSession extends ChatResponse {
  sessionId: string;
  usage?: UsageInfo;
}

export interface ExtractResponseWithUsage {
  extractedMemories: {
    fact: string;
    about: string;
    confidence: number;
  }[];
  extractedEntities: {
    extractedName: string;
    matchedId: string | null;
    confidence: number;
  }[];
  usage?: UsageInfo;
}

export const chatService = {
  async sendMessage(
    message: string,
    history: Pick<ChatMessage, 'role' | 'content'>[] = [],
    sessionId?: string
  ): Promise<ChatResponseWithSession> {
    const response = await api.post('/chat', { message, history, sessionId });
    return response.data;
  },

  /**
   * Streaming variant of sendMessage. Parses the SSE stream from
   * POST /chat/stream, invoking onToken for every delta, and resolves with
   * the final "done" payload (full response + relatedStories/suggestedActions).
   */
  async sendMessageStream(
    message: string,
    sessionId: string | undefined,
    history: Pick<ChatMessage, 'role' | 'content'>[],
    onToken: (token: string) => void
  ): Promise<ChatResponseWithSession> {
    // Same token source the axios instance uses (see services/api.ts)
    const token = useAuthStore.getState().token;

    const response = await fetch(`${API_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, history, sessionId }),
    });

    if (!response.ok) {
      let errorMessage = `Chat stream failed (${response.status})`;
      try {
        const data = await response.json();
        errorMessage = data?.error?.message || errorMessage;
      } catch {
        // non-JSON error body
      }
      throw new Error(errorMessage);
    }
    if (!response.body) {
      throw new Error('Streaming is not supported in this browser');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload: ChatResponseWithSession | null = null;

    const handleEvent = (raw: string) => {
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        let event: any;
        try {
          event = JSON.parse(json);
        } catch {
          continue;
        }
        if (event.type === 'token' && typeof event.content === 'string') {
          onToken(event.content);
        } else if (event.type === 'done') {
          donePayload = {
            response: event.response ?? '',
            relatedStories: event.relatedStories,
            relatedPhotos: event.relatedPhotos,
            suggestedActions: event.suggestedActions,
            sessionId: event.sessionId,
            usage: event.usage,
          };
        } else if (event.type === 'error') {
          throw new Error(event.message || 'Chat stream failed');
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) handleEvent(event);
    }
    if (buffer.trim()) handleEvent(buffer);

    if (!donePayload) {
      throw new Error('Chat stream ended unexpectedly');
    }
    return donePayload;
  },

  async extractEntities(content: string): Promise<ExtractResponseWithUsage> {
    const response = await api.post('/chat/extract', { content });
    return response.data;
  },
};
