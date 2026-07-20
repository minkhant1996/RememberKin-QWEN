// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  familyId?: string;
}

export interface PendingInvite {
  inviteToken: string;
  familyId: string;
  familyName: string;
  inviterName: string;
  placeholderId: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  pendingInvites?: PendingInvite[];
}

// Family types
export interface Family {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  birthDate?: string;
  deathDate?: string;
  isDeceased?: boolean;
  avatar?: string;
  preferences?: Record<string, string>;
  isRegistered?: boolean;
  inviteEmail?: string;
  addedById?: string;
}

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

// Story types
export interface Story {
  id: string;
  content: string;
  summary?: string;
  mood?: 'happy' | 'sad' | 'nostalgic' | 'funny' | 'serious';
  topics: string[];
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
  };
}

// Memory types
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

// Event types
export interface FamilyEvent {
  id: string;
  type: 'birthday' | 'anniversary' | 'surgery' | 'custom';
  title: string;
  description?: string;
  date: string;
  daysUntil?: number;
  recurring: boolean;
  reminderDays: number[];
  involves: {
    id: string;
    name: string;
  }[];
  createdAt: string;
}

// Chat types
export interface PhotoRef {
  id: string;
  url: string;
  caption?: string | null;
  note?: string | null;
  taggedMembers?: { id: string; name: string }[];
  createdAt?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

// Search types
export interface SearchResult {
  type: 'story' | 'memory';
  id: string;
  content: string;
  summary?: string;
  relevance: number;
}

// Notification types
export interface Notification {
  id: string;
  type: 'reminder' | 'story' | 'suggestion';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// ==================== MULTI-LAYER MEMORY TYPES ====================

// Working Memory
export interface ActiveEntity {
  id: string;
  name: string;
  type: 'person' | 'topic' | 'event' | 'location';
  mentionCount: number;
  lastMentioned: string;
}

export interface PendingFact {
  id: string;
  fact: string;
  aboutId?: string;
  aboutName: string;
  confidence: number;
  extractedFrom: string;
  extractedAt: string;
}

export interface WorkingMemoryState {
  sessions: number;
  pendingFacts: PendingFact[];
  activeEntities: ActiveEntity[];
  currentTopics: string[];
  lastUpdated: string | null;
}

// Episodic Memory
export type EpisodicEventType = 'conversation' | 'story_added' | 'event_created' | 'memory_recalled';

export interface EpisodicMemory {
  id: string;
  familyId: string;
  sessionId: string;
  eventType: EpisodicEventType;
  content: string;
  summary?: string;
  emotionalValence: number;
  importance: number;
  participants: string[];
  extractedFacts: string[];
  accessCount: number;
  lastAccessed: string;
  consolidated: boolean;
  consolidatedAt?: string;
  createdAt: string;
}

// Semantic Memory
export type FactType = 'preference' | 'trait' | 'biographical' | 'relationship' | 'routine' | 'opinion';

export interface SemanticMemory {
  id: string;
  familyId: string;
  layer: 'semantic';
  factType: FactType;
  fact: string;
  aboutId: string;
  aboutName: string;
  confidence: number;
  reinforcementCount: number;
  lastReinforced: string;
  decayFactor: number;
  sourceEpisodes: string[];
  createdAt: string;
  updatedAt: string;
}

// Procedural Memory
export type PatternType = 'routine' | 'preference_cluster' | 'interaction_style' | 'trigger_response';

export interface ProceduralMemory {
  id: string;
  familyId: string;
  patternType: PatternType;
  name: string;
  description: string;
  trigger: string;
  action: string;
  frequency: number;
  confidence: number;
  appliesToIds: string[];
  examples: string[];
  createdAt: string;
  updatedAt: string;
}

// Memory Statistics
export interface WorkingMemoryStats {
  count: number;
  pendingFacts: number;
  activeEntities: number;
}

export interface EpisodicMemoryStats {
  count: number;
  unconsolidated: number;
  avgImportance: number;
}

export interface SemanticMemoryStats {
  count: number;
  avgConfidence: number;
  totalReinforcements: number;
}

export interface ProceduralMemoryStats {
  count: number;
  avgConfidence: number;
}

export interface MemoryStats {
  working: WorkingMemoryStats;
  episodic: EpisodicMemoryStats;
  semantic: SemanticMemoryStats;
  procedural: ProceduralMemoryStats;
  lastUpdated: string;
}

// Memory Activity
export type MemoryActivityType =
  | 'extracted'
  | 'episode_created'
  | 'consolidated'
  | 'reinforced'
  | 'decayed'
  | 'pattern_detected'
  | 'memory_recalled';

export interface MemoryActivity {
  id: string;
  familyId: string;
  type: MemoryActivityType;
  description: string;
  fromLayer?: 'working' | 'episodic' | 'semantic' | 'procedural';
  toLayer?: 'working' | 'episodic' | 'semantic' | 'procedural';
  memoryId?: string;
  memoryFact?: string;
  confidence?: number;
  timestamp: string;
}

// Consolidation
export interface ConsolidationCandidate {
  episodeId: string;
  fact: string;
  aboutId: string;
  aboutName: string;
  mentionCount: number;
  totalImportance: number;
  suggestedConfidence: number;
  factType: FactType;
}

export interface ConsolidationResult {
  processed: number;
  consolidated: number;
  reinforced: number;
  skipped: number;
  newMemoriesCount: number;
  reinforcedMemoriesCount: number;
}

// Memory Layer Type
export type MemoryLayer = 'working' | 'episodic' | 'semantic' | 'procedural';

// ==================== USAGE & COST TRACKING TYPES ====================

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
}

export interface UsageInfo {
  model?: string;
  models?: string[];
  tokenUsage: TokenUsage;
  costEstimate: CostEstimate;
  latencyMs: number;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requests: number;
  byModel: Record<string, {
    input: number;
    output: number;
    cost: number;
    requests: number;
  }>;
}

export interface ModelPricing {
  id: string;
  name: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextWindow: number;
  maxOutput: number;
  category: 'chat' | 'vision' | 'embedding' | 'reasoning' | 'coding' | 'tts' | 'asr' | 'image' | 'video' | 'translation';
  hasFreeQuota: boolean;
  freeQuotaTokens?: number;
}

export interface ModelConfig {
  task: string;
  model: string;
  pricing: ModelPricing | null;
}
