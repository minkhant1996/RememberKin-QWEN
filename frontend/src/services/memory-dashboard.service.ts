import api from './api';
import {
  MemoryStats,
  WorkingMemoryState,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  MemoryActivity,
  ConsolidationCandidate,
  ConsolidationResult,
  EpisodicEventType,
  FactType,
} from '../types';

const emptyStats: MemoryStats = {
  working: { count: 0, pendingFacts: 0, activeEntities: 0 },
  episodic: { count: 0, unconsolidated: 0, avgImportance: 0 },
  semantic: { count: 0, avgConfidence: 0, totalReinforcements: 0 },
  procedural: { count: 0, avgConfidence: 0 },
  lastUpdated: new Date(0).toISOString(),
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object') {
    const maybeNeo4jInt = value as { low?: unknown; high?: unknown; toNumber?: () => number };
    if (typeof maybeNeo4jInt.toNumber === 'function') {
      return maybeNeo4jInt.toNumber();
    }
    if (typeof maybeNeo4jInt.low === 'number') {
      return maybeNeo4jInt.low;
    }
  }
  return 0;
}

function normalizeStats(stats: Partial<MemoryStats> | null | undefined): MemoryStats {
  return {
    working: {
      count: toNumber(stats?.working?.count),
      pendingFacts: toNumber(stats?.working?.pendingFacts),
      activeEntities: toNumber(stats?.working?.activeEntities),
    },
    episodic: {
      count: toNumber(stats?.episodic?.count),
      unconsolidated: toNumber(stats?.episodic?.unconsolidated),
      avgImportance: toNumber(stats?.episodic?.avgImportance),
    },
    semantic: {
      count: toNumber(stats?.semantic?.count),
      avgConfidence: toNumber(stats?.semantic?.avgConfidence),
      totalReinforcements: toNumber(stats?.semantic?.totalReinforcements),
    },
    procedural: {
      count: toNumber(stats?.procedural?.count),
      avgConfidence: toNumber(stats?.procedural?.avgConfidence),
    },
    lastUpdated: stats?.lastUpdated ?? emptyStats.lastUpdated,
  };
}

function normalizeWorkingMemory(working: Partial<WorkingMemoryState> | null | undefined): WorkingMemoryState {
  return {
    sessions: working?.sessions ?? 0,
    pendingFacts: working?.pendingFacts ?? [],
    activeEntities: working?.activeEntities ?? [],
    currentTopics: working?.currentTopics ?? [],
    lastUpdated: working?.lastUpdated ?? null,
  };
}

export interface EpisodicQueryOptions {
  limit?: number;
  offset?: number;
  unconsolidatedOnly?: boolean;
  minImportance?: number;
  eventType?: EpisodicEventType;
  sortBy?: 'createdAt' | 'importance' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
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

export interface EpisodicMemoriesResponse {
  memories: EpisodicMemory[];
  total: number;
  hasMore: boolean;
}

export interface SemanticMemoriesResponse {
  memories: SemanticMemory[];
  byPerson: Record<string, SemanticMemory[]>;
  total: number;
  hasMore: boolean;
}

export interface ProceduralMemoriesResponse {
  patterns: ProceduralMemory[];
  total: number;
}

export interface ActivityResponse {
  activities: MemoryActivity[];
  total: number;
}

export interface ConsolidationQueueResponse {
  candidates: ConsolidationCandidate[];
  total: number;
}

export interface ConsolidateResponse {
  success: boolean;
  result: ConsolidationResult;
  activities: MemoryActivity[];
}

export interface PatternDetectionResponse {
  success: boolean;
  result: {
    patternsFound: number;
    newPatternsCount: number;
    reinforcedPatternsCount: number;
  };
  newPatterns: ProceduralMemory[];
}

export interface DecayResponse {
  success: boolean;
  decayedCount: number;
  decayAmount: number;
}

export interface MaintenanceResponse {
  success: boolean;
  result: {
    workingMemory: {
      sessionsRemoved: number;
      factsRemoved: number;
    };
    agingDecay: number;
    pruned: {
      semanticPruned: number;
      episodicPruned: number;
    };
    episodicEnforced: number;
    summarized: number;
  };
  message: string;
}

export interface ContextResponse {
  context: string;
  tokenCount: number;
  memoriesUsed: number;
  wasTruncated: boolean;
  message: string;
}

export const memoryDashboardService = {
  // Get memory statistics for all layers
  getStats: async (): Promise<MemoryStats> => {
    const response = await api.get<MemoryStats>('/memory-dashboard/stats');
    return normalizeStats(response.data);
  },

  // Get current working memory state
  getWorking: async (): Promise<WorkingMemoryState> => {
    const response = await api.get<WorkingMemoryState>('/memory-dashboard/working');
    return normalizeWorkingMemory(response.data);
  },

  // Get episodic memories with optional filtering
  getEpisodic: async (options?: EpisodicQueryOptions): Promise<EpisodicMemoriesResponse> => {
    const response = await api.get<EpisodicMemoriesResponse>('/memory-dashboard/episodic', {
      params: options,
    });
    return {
      memories: response.data.memories ?? [],
      total: response.data.total ?? 0,
      hasMore: response.data.hasMore ?? false,
    };
  },

  // Get semantic memories with optional filtering
  getSemantic: async (options?: SemanticQueryOptions): Promise<SemanticMemoriesResponse> => {
    const response = await api.get<SemanticMemoriesResponse>('/memory-dashboard/semantic', {
      params: options,
    });
    return {
      memories: response.data.memories ?? [],
      byPerson: response.data.byPerson ?? {},
      total: response.data.total ?? 0,
      hasMore: response.data.hasMore ?? false,
    };
  },

  // Get procedural memories (patterns)
  getProcedural: async (): Promise<ProceduralMemoriesResponse> => {
    const response = await api.get<ProceduralMemoriesResponse>('/memory-dashboard/procedural');
    return {
      patterns: response.data.patterns ?? [],
      total: response.data.total ?? 0,
    };
  },

  // Get recent activity feed
  getActivity: async (limit: number = 20): Promise<ActivityResponse> => {
    const response = await api.get<ActivityResponse>('/memory-dashboard/activity', {
      params: { limit },
    });
    return {
      activities: response.data.activities ?? [],
      total: response.data.total ?? 0,
    };
  },

  // Get consolidation queue (candidates)
  getConsolidationQueue: async (): Promise<ConsolidationQueueResponse> => {
    const response = await api.get<ConsolidationQueueResponse>('/memory-dashboard/consolidation-queue');
    return {
      candidates: response.data.candidates ?? [],
      total: response.data.total ?? 0,
    };
  },

  // Trigger manual consolidation
  consolidate: async (): Promise<ConsolidateResponse> => {
    const response = await api.post<ConsolidateResponse>('/memory-dashboard/consolidate');
    return response.data;
  },

  // Trigger pattern detection
  detectPatterns: async (): Promise<PatternDetectionResponse> => {
    const response = await api.post<PatternDetectionResponse>('/memory-dashboard/detect-patterns');
    return response.data;
  },

  // Apply memory decay (for demo)
  applyDecay: async (decayAmount: number = 0.01): Promise<DecayResponse> => {
    const response = await api.post<DecayResponse>('/memory-dashboard/apply-decay', {
      decayAmount,
    });
    return response.data;
  },

  // Run full maintenance (cleanup + decay + prune)
  // TIMELY FORGETTING: Automatic memory cleanup
  runMaintenance: async (): Promise<MaintenanceResponse> => {
    const response = await api.post<MaintenanceResponse>('/memory-dashboard/maintenance');
    return response.data;
  },

  // Get optimized context for chat
  // CONTEXT WINDOW MANAGEMENT: Token-optimized memory context
  getContext: async (query: string = '', maxTokens: number = 4000): Promise<ContextResponse> => {
    const response = await api.get<ContextResponse>('/memory-dashboard/context', {
      params: { query, maxTokens },
    });
    return response.data;
  },
};
