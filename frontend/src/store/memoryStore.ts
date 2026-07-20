import { create } from 'zustand';
import {
  MemoryStats,
  MemoryActivity,
  MemoryLayer,
  WorkingMemoryState,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ConsolidationCandidate,
} from '../types';

interface MemoryState {
  // Data
  stats: MemoryStats | null;
  activity: MemoryActivity[];
  workingMemory: WorkingMemoryState | null;
  episodicMemories: EpisodicMemory[];
  semanticMemories: SemanticMemory[];
  proceduralMemories: ProceduralMemory[];
  consolidationQueue: ConsolidationCandidate[];

  // UI State
  selectedLayer: MemoryLayer;
  isLoading: boolean;
  isConsolidating: boolean;
  isDetectingPatterns: boolean;
  error: string | null;

  // Actions
  setStats: (stats: MemoryStats) => void;
  setActivity: (activity: MemoryActivity[]) => void;
  addActivity: (activity: MemoryActivity) => void;
  setWorkingMemory: (working: WorkingMemoryState) => void;
  setEpisodicMemories: (memories: EpisodicMemory[]) => void;
  setSemanticMemories: (memories: SemanticMemory[]) => void;
  setProceduralMemories: (memories: ProceduralMemory[]) => void;
  setConsolidationQueue: (candidates: ConsolidationCandidate[]) => void;
  setSelectedLayer: (layer: MemoryLayer) => void;
  setLoading: (loading: boolean) => void;
  setConsolidating: (consolidating: boolean) => void;
  setDetectingPatterns: (detecting: boolean) => void;
  setError: (error: string | null) => void;
  clearAll: () => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  // Initial data
  stats: null,
  activity: [],
  workingMemory: null,
  episodicMemories: [],
  semanticMemories: [],
  proceduralMemories: [],
  consolidationQueue: [],

  // Initial UI state
  selectedLayer: 'working',
  isLoading: false,
  isConsolidating: false,
  isDetectingPatterns: false,
  error: null,

  // Actions
  setStats: (stats) => set({ stats }),

  setActivity: (activity) => set({ activity }),

  addActivity: (activity) =>
    set((state) => ({
      activity: [activity, ...state.activity].slice(0, 50), // Keep last 50
    })),

  setWorkingMemory: (working) => set({ workingMemory: working }),

  setEpisodicMemories: (memories) => set({ episodicMemories: memories }),

  setSemanticMemories: (memories) => set({ semanticMemories: memories }),

  setProceduralMemories: (memories) => set({ proceduralMemories: memories }),

  setConsolidationQueue: (candidates) => set({ consolidationQueue: candidates }),

  setSelectedLayer: (layer) => set({ selectedLayer: layer }),

  setLoading: (loading) => set({ isLoading: loading }),

  setConsolidating: (consolidating) => set({ isConsolidating: consolidating }),

  setDetectingPatterns: (detecting) => set({ isDetectingPatterns: detecting }),

  setError: (error) => set({ error }),

  clearAll: () =>
    set({
      stats: null,
      activity: [],
      workingMemory: null,
      episodicMemories: [],
      semanticMemories: [],
      proceduralMemories: [],
      consolidationQueue: [],
      error: null,
    }),
}));
