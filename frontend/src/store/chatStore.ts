import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  /** Which user this chat history belongs to — cleared when someone else logs in */
  ownerId: string | null;
  isLoading: boolean;
  addMessage: (message: ChatMessage) => void;
  /** Update the most recent message in place (used for streaming tokens) */
  updateLastMessage: (content: string, extra?: Partial<ChatMessage>) => void;
  setSessionId: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  ensureOwner: (userId: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      sessionId: null,
      ownerId: null,
      isLoading: false,

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      updateLastMessage: (content, extra) =>
        set((state) => {
          if (state.messages.length === 0) return {};
          const messages = [...state.messages];
          const lastIndex = messages.length - 1;
          messages[lastIndex] = { ...messages[lastIndex], ...extra, content };
          return { messages };
        }),

      setSessionId: (sessionId) =>
        set({
          sessionId,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      clearMessages: () =>
        set({
          messages: [],
          sessionId: null,
        }),

      ensureOwner: (userId) => {
        if (get().ownerId !== userId) {
          set({ messages: [], sessionId: null, ownerId: userId });
        }
      },
    }),
    {
      name: 'rememberkin-chat',
      partialize: (state) => ({
        // Keep the last 50 messages; never persist the loading flag
        messages: state.messages.slice(-50),
        sessionId: state.sessionId,
        ownerId: state.ownerId,
      }),
    }
  )
);
