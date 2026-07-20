// Person / Family Member
export interface Person {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  birthDate?: string;
  deathDate?: string;      // Date of death for deceased members
  isDeceased?: boolean;    // Whether this person has passed away
  avatar?: string;
  preferences?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
  isRegistered?: boolean;  // false for placeholder (unregistered) members
  inviteEmail?: string;    // email used for invite matching; cleared on decline
  addedById?: string;      // id of the person who created this placeholder
}

// Pending family invite (for unregistered members)
export interface FamilyInvite {
  id: string;
  token: string;
  email: string;
  familyId: string;
  placeholderId: string;
  inviterId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  createdAt: string;
}

// Family
export interface Family {
  id: string;
  name: string;
  memberCount?: number;
  createdAt: string;
}

// Family Tree
export interface FamilyTreeNode {
  id: string;
  name: string;
  nickname?: string;
  birthDate?: string;
  deathDate?: string;
  isDeceased?: boolean;
  avatar?: string;
  isRegistered?: boolean;
}

export interface FamilyTreeEdge {
  from: string;
  to: string;
  relationship: 'PARENT_OF' | 'SPOUSE_OF' | 'SIBLING_OF';
}

export interface FamilyTree {
  nodes: FamilyTreeNode[];
  edges: FamilyTreeEdge[];
}

// Story
export interface Story {
  id: string;
  content: string;
  summary?: string;
  mood?: 'happy' | 'sad' | 'nostalgic' | 'funny' | 'serious';
  topics: string[];
  mediaUrls?: string[];
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  mentions: {
    id: string;
    name: string;
  }[];
  createdAt: string;
}

export interface CreateStoryInput {
  content: string;
  authorId: string;
  visibility?: {
    type: 'public' | 'specific';
    allowedUsers?: string[];
    hiddenFrom?: string[];
  };
}

// Memory (extracted fact)
export interface Memory {
  id: string;
  fact: string;
  confidence: number;
  about: {
    id: string;
    name: string;
  };
  source?: string;
  createdAt: string;
}

// Event
export interface Event {
  id: string;
  type: 'birthday' | 'anniversary' | 'surgery' | 'custom';
  title: string;
  description?: string;
  date: string;
  recurring: boolean;
  reminderDays: number[];
  involves: {
    id: string;
    name: string;
  }[];
  createdAt: string;
}

export interface CreateEventInput {
  type: Event['type'];
  title: string;
  description?: string;
  date: string;
  recurring?: boolean;
  reminderDays?: number[];
  involves: string[];
  visibility?: {
    allowedUsers?: string[];
  };
}

// Chat
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatContext {
  familyId: string;
  familyName: string;
  userName: string;
  memberCount: number;
  storyCount: number;
  memoryCount: number;
  relevantMemories: Memory[];
  familyTree?: FamilyTree;
  memoryContext?: string;
  members?: {
    name: string;
    nickname?: string;
    birthDate?: string;
    isDeceased?: boolean;
  }[];
  upcomingEvents?: {
    title: string;
    date: string;
    type?: string;
  }[];
  relevantPhotos?: PhotoRef[];
  history: ChatMessage[];
}

export interface PhotoRef {
  id: string;
  url: string;
  caption?: string | null;
  note?: string | null;
  taggedMembers?: { id: string; name: string }[];
  createdAt?: string;
}

export interface ChatResponse {
  response: string;
  relatedStories?: {
    id: string;
    summary: string;
  }[];
  relatedPhotos?: PhotoRef[];
  suggestedActions?: {
    type: string;
    label: string;
    payload?: Record<string, unknown>;
  }[];
}

// Extracted entities from LLM
export interface ExtractedEntities {
  people: {
    name: string;
    relationship?: string;
    attributes?: string[];
  }[];
  facts: {
    about: string;
    fact: string;
    confidence: number;
  }[];
  events: {
    title: string;
    date?: string;
    involves: string[];
  }[];
  locations: string[];
}

// Search
export interface SearchResult {
  type: 'story' | 'memory';
  id: string;
  content: string;
  relevance: number;
}
