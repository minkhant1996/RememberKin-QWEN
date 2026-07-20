# Rememberkin - Frontend Implementation Guide

## Overview

The Rememberkin frontend is built with React 18, TypeScript, and Vite. It uses Tailwind CSS for styling, Zustand for state management, and TanStack Query for server state.

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/                 # Base UI components (shadcn/ui)
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── ...
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── SuggestedActions.tsx
│   │   ├── family/
│   │   │   ├── FamilyTree.tsx
│   │   │   ├── FamilyNode.tsx
│   │   │   ├── MemberCard.tsx
│   │   │   └── AddMemberModal.tsx
│   │   ├── stories/
│   │   │   ├── StoryList.tsx
│   │   │   ├── StoryCard.tsx
│   │   │   ├── StoryDetail.tsx
│   │   │   └── CreateStory.tsx
│   │   ├── events/
│   │   │   ├── EventCalendar.tsx
│   │   │   ├── EventCard.tsx
│   │   │   └── CreateEvent.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Chat.tsx
│   │   ├── Family.tsx
│   │   ├── Stories.tsx
│   │   ├── Events.tsx
│   │   ├── Member.tsx
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useFamily.ts
│   │   ├── useStories.ts
│   │   ├── useChat.ts
│   │   ├── useWebSocket.ts
│   │   └── useMemories.ts
│   ├── services/
│   │   ├── api.ts              # Axios instance
│   │   ├── auth.service.ts
│   │   ├── family.service.ts
│   │   ├── story.service.ts
│   │   ├── chat.service.ts
│   │   └── websocket.service.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   └── notificationStore.ts
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── family.types.ts
│   │   ├── story.types.ts
│   │   └── chat.types.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── helpers.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

## Key Components

### 1. Chat Interface

```tsx
// src/components/chat/ChatWindow.tsx

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SuggestedActions } from './SuggestedActions';

export function ChatWindow() {
  const { messages, isLoading, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-medium">Welcome to Rememberkin</p>
            <p className="mt-2">Ask me about your family stories, or tell me something new!</p>
            <div className="mt-4 space-y-2">
              <SuggestedPrompt text="What stories did grandma tell?" />
              <SuggestedPrompt text="When is Uncle Joe's birthday?" />
              <SuggestedPrompt text="Tell me about our family history" />
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-pulse">Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Actions */}
      {messages.length > 0 && messages[messages.length - 1].suggestedActions && (
        <SuggestedActions actions={messages[messages.length - 1].suggestedActions!} />
      )}

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}

function SuggestedPrompt({ text }: { text: string }) {
  const { sendMessage } = useChat();

  return (
    <button
      onClick={() => sendMessage(text)}
      className="block w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
    >
      {text}
    </button>
  );
}
```

### 2. Family Tree Visualization

```tsx
// src/components/family/FamilyTree.tsx

import { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFamily } from '@/hooks/useFamily';
import { FamilyNode } from './FamilyNode';

const nodeTypes = {
  familyMember: FamilyNode,
};

export function FamilyTree() {
  const { familyTree, isLoading } = useFamily();

  const initialNodes: Node[] = familyTree?.nodes.map((member, idx) => ({
    id: member.id,
    type: 'familyMember',
    data: {
      name: member.name,
      nickname: member.nickname,
      avatar: member.avatar,
      birthDate: member.birthDate,
    },
    position: calculatePosition(idx, familyTree.nodes.length),
  })) || [];

  const initialEdges: Edge[] = familyTree?.edges.map((edge) => ({
    id: `${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    label: formatRelationship(edge.relationship),
    type: 'smoothstep',
  })) || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading family tree...</div>;
  }

  return (
    <div className="w-full h-[600px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function calculatePosition(index: number, total: number): { x: number; y: number } {
  // Simple grid layout - can be enhanced with actual tree layout algorithm
  const cols = Math.ceil(Math.sqrt(total));
  const row = Math.floor(index / cols);
  const col = index % cols;
  return { x: col * 200, y: row * 150 };
}

function formatRelationship(rel: string): string {
  const map: Record<string, string> = {
    'PARENT_OF': 'parent',
    'SPOUSE_OF': 'spouse',
    'SIBLING_OF': 'sibling',
  };
  return map[rel] || rel;
}
```

### 3. Story Card

```tsx
// src/components/stories/StoryCard.tsx

import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Story } from '@/types/story.types';

interface StoryCardProps {
  story: Story;
  onClick?: () => void;
}

export function StoryCard({ story, onClick }: StoryCardProps) {
  return (
    <Card
      className="p-4 hover:shadow-lg transition cursor-pointer"
      onClick={onClick}
    >
      {/* Author */}
      <div className="flex items-center space-x-3 mb-3">
        <Avatar src={story.author.avatar} name={story.author.name} size="sm" />
        <div>
          <p className="font-medium">{story.author.name}</p>
          <p className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Content */}
      <p className="text-gray-700 line-clamp-3">{story.content}</p>

      {/* Mood & Topics */}
      <div className="mt-3 flex items-center space-x-2">
        <MoodBadge mood={story.mood} />
        {story.topics.slice(0, 3).map((topic) => (
          <span
            key={topic}
            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
          >
            {topic}
          </span>
        ))}
      </div>

      {/* Mentions */}
      {story.mentions.length > 0 && (
        <div className="mt-3 flex items-center space-x-1">
          <span className="text-sm text-gray-500">Mentions:</span>
          {story.mentions.map((person) => (
            <span key={person.id} className="text-sm text-blue-600">
              {person.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function MoodBadge({ mood }: { mood: string }) {
  const moodEmoji: Record<string, string> = {
    happy: '😊',
    sad: '😢',
    nostalgic: '🥹',
    funny: '😄',
    serious: '🤔',
  };

  return (
    <span className="text-lg" title={mood}>
      {moodEmoji[mood] || '📝'}
    </span>
  );
}
```

### 4. Custom Hooks

```tsx
// src/hooks/useChat.ts

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage, ChatContext } from '@/types/chat.types';

export function useChat() {
  const { messages, addMessage, setLoading, isLoading } = useChatStore();

  const mutation = useMutation({
    mutationFn: (message: string) => chatService.sendMessage(message),
    onMutate: (message) => {
      addMessage({ role: 'user', content: message });
      setLoading(true);
    },
    onSuccess: (response) => {
      addMessage({
        role: 'assistant',
        content: response.response,
        relatedStories: response.relatedStories,
        suggestedActions: response.suggestedActions,
      });
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  const sendMessage = useCallback((message: string) => {
    mutation.mutate(message);
  }, [mutation]);

  return {
    messages,
    isLoading,
    sendMessage,
    error: mutation.error,
  };
}

// src/hooks/useWebSocket.ts

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { token, user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!token || !user?.familyId) return;

    const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', familyId: user.familyId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [token, user?.familyId]);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'reminder':
        addNotification({
          type: 'reminder',
          title: data.event.title,
          message: data.message,
        });
        break;
      case 'story:created':
        addNotification({
          type: 'story',
          title: 'New Story',
          message: `${data.story.author.name} shared a new story`,
        });
        break;
      case 'agent:suggestion':
        addNotification({
          type: 'suggestion',
          title: 'Memory Keeper',
          message: data.message,
        });
        break;
    }
  }, [addNotification]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
```

### 5. API Service

```tsx
// src/services/api.ts

import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// src/services/chat.service.ts

import api from './api';
import { ChatResponse } from '@/types/chat.types';

export const chatService = {
  async sendMessage(message: string): Promise<ChatResponse> {
    const response = await api.post('/chat', { message });
    return response.data;
  },

  async extractEntities(content: string) {
    const response = await api.post('/chat/extract', { content });
    return response.data;
  },
};

// src/services/story.service.ts

import api from './api';
import { Story, CreateStoryInput } from '@/types/story.types';

export const storyService = {
  async getStories(params?: { page?: number; author?: string }): Promise<{ stories: Story[]; pagination: any }> {
    const response = await api.get('/stories', { params });
    return response.data;
  },

  async getStory(id: string): Promise<Story> {
    const response = await api.get(`/stories/${id}`);
    return response.data;
  },

  async createStory(data: CreateStoryInput): Promise<Story> {
    const response = await api.post('/stories', data);
    return response.data;
  },

  async deleteStory(id: string): Promise<void> {
    await api.delete(`/stories/${id}`);
  },

  async reactToStory(id: string, emoji: string): Promise<void> {
    await api.post(`/stories/${id}/react`, { emoji });
  },
};
```

### 6. State Management

```tsx
// src/store/authStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  familyId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

// src/store/chatStore.ts

import { create } from 'zustand';
import { ChatMessage } from '@/types/chat.types';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (message: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [] }),
}));
```

## Environment Variables

```env
# .env.example

VITE_API_URL=http://localhost:6100/api/v1
VITE_WS_URL=ws://localhost:6100/ws
```

## Running the Frontend

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

## Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.5.0",
    "axios": "^1.6.0",
    "reactflow": "^11.10.0",
    "date-fns": "^3.3.0",
    "lucide-react": "^0.312.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/react": "^18.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```
