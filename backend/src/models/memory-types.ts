// Multi-Layer Memory System Types

// ==================== LAYER 1: WORKING MEMORY ====================
// Ephemeral, session-scoped memory for current conversation context

export interface ActiveEntity {
  id: string;
  name: string;
  type: 'person' | 'topic' | 'event' | 'location';
  mentionCount: number;
  lastMentioned: Date;
}

export interface PendingFact {
  id: string;
  fact: string;
  aboutId?: string;
  aboutName: string;
  confidence: number;
  extractedFrom: string;
  extractedAt: Date;
}

export interface WorkingMemory {
  sessionId: string;
  familyId: string;
  userId: string;
  currentTopics: string[];
  activeEntities: ActiveEntity[];
  pendingFacts: PendingFact[];
  attentionWindow: string[]; // Recent message IDs for context
  createdAt: Date;
  updatedAt: Date;
}

// ==================== LAYER 2: EPISODIC MEMORY ====================
// Short-term, episode-based memory for conversations and events

export type EpisodicEventType = 'conversation' | 'story_added' | 'event_created' | 'memory_recalled';

export interface EpisodicMemory {
  id: string;
  familyId: string;
  sessionId: string;
  eventType: EpisodicEventType;
  content: string;
  summary?: string;
  emotionalValence: number; // -1 (negative) to 1 (positive)
  importance: number; // 0 to 1
  participants: string[]; // Person IDs
  extractedFacts: string[]; // Fact strings
  accessCount: number;
  lastAccessed: Date;
  consolidated: boolean;
  consolidatedAt?: Date;
  createdAt: Date;
}

export interface CreateEpisodicInput {
  familyId: string;
  sessionId: string;
  eventType: EpisodicEventType;
  content: string;
  summary?: string;
  emotionalValence?: number;
  importance?: number;
  participants?: string[];
  extractedFacts?: string[];
}

export interface EpisodicQueryOptions {
  limit?: number;
  offset?: number;
  unconsolidatedOnly?: boolean;
  consolidated?: boolean;
  minImportance?: number;
  eventType?: EpisodicEventType;
  sortBy?: 'createdAt' | 'importance' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}

// ==================== LAYER 3: SEMANTIC MEMORY ====================
// Long-term, fact-based memory with confidence and reinforcement

export type FactType = 'preference' | 'trait' | 'biographical' | 'relationship' | 'routine' | 'opinion';

export interface SemanticMemory {
  id: string;
  familyId: string;
  layer: 'semantic';
  factType: FactType;
  fact: string;
  aboutId: string;
  aboutName: string;
  confidence: number; // 0 to 1
  reinforcementCount: number;
  lastReinforced: Date;
  decayFactor: number; // 0 to 1, lower = more decayed
  sourceEpisodes: string[]; // Episode IDs this was extracted from
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSemanticInput {
  familyId: string;
  factType: FactType;
  fact: string;
  aboutId: string;
  aboutName: string;
  confidence?: number;
  sourceEpisodeId?: string;
}

export interface SemanticQueryOptions {
  limit?: number;
  offset?: number;
  aboutId?: string;
  factType?: FactType;
  minConfidence?: number;
  sortBy?: 'confidence' | 'reinforcementCount' | 'createdAt' | 'decayFactor';
  sortOrder?: 'asc' | 'desc';
}

// ==================== LAYER 4: PROCEDURAL MEMORY ====================
// Learned patterns, routines, and behaviors

export type PatternType = 'routine' | 'preference_cluster' | 'interaction_style' | 'trigger_response';

export interface ProceduralMemory {
  id: string;
  familyId: string;
  patternType: PatternType;
  name: string;
  description: string;
  trigger: string; // What triggers this pattern
  action: string; // What action/response to take
  frequency: number; // How often observed
  confidence: number; // 0 to 1
  appliesToIds: string[]; // Person IDs this applies to
  examples: string[]; // Example episode IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProceduralInput {
  familyId: string;
  patternType: PatternType;
  name: string;
  description: string;
  trigger: string;
  action: string;
  appliesToIds?: string[];
  exampleEpisodeId?: string;
}

// ==================== DASHBOARD & STATISTICS ====================

export interface MemoryLayerStats {
  count: number;
  recentCount?: number; // Last 24 hours
}

export interface WorkingMemoryStats extends MemoryLayerStats {
  pendingFacts: number;
  activeEntities: number;
}

export interface EpisodicMemoryStats extends MemoryLayerStats {
  unconsolidated: number;
  avgImportance: number;
}

export interface SemanticMemoryStats extends MemoryLayerStats {
  avgConfidence: number;
  totalReinforcements: number;
}

export interface ProceduralMemoryStats extends MemoryLayerStats {
  avgConfidence: number;
}

export interface MemoryStats {
  working: WorkingMemoryStats;
  episodic: EpisodicMemoryStats;
  semantic: SemanticMemoryStats;
  procedural: ProceduralMemoryStats;
  lastUpdated: Date;
}

// ==================== ACTIVITY FEED ====================

export type MemoryActivityType =
  | 'extracted'       // Fact extracted to working memory
  | 'episode_created' // Conversation saved as episode
  | 'consolidated'    // Episode consolidated to semantic
  | 'reinforced'      // Existing memory reinforced
  | 'decayed'         // Memory confidence decayed
  | 'pattern_detected' // New procedural pattern found
  | 'memory_recalled'; // Memory was accessed/used

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
  timestamp: Date;
}

export interface CreateActivityInput {
  familyId: string;
  type: MemoryActivityType;
  description: string;
  fromLayer?: MemoryActivity['fromLayer'];
  toLayer?: MemoryActivity['toLayer'];
  memoryId?: string;
  memoryFact?: string;
  confidence?: number;
}

// ==================== CONSOLIDATION ====================

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
  newSemanticMemories: SemanticMemory[];
  reinforcedMemories: string[];
  activities: MemoryActivity[];
}

// ==================== PATTERN DETECTION ====================

export interface DetectedPattern {
  patternType: PatternType;
  name: string;
  description: string;
  trigger: string;
  action: string;
  confidence: number;
  supportingEpisodes: string[];
  appliesToIds: string[];
}

export interface PatternDetectionResult {
  patternsFound: number;
  newPatterns: ProceduralMemory[];
  reinforcedPatterns: string[];
}
