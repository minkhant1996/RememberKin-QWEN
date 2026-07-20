/**
 * Simulation Service
 *
 * API client for running and monitoring agent simulations.
 */

import api from './api';

export interface TestUserPersona {
  id: string;
  name: string;
  description: string;
  personality: string;
  goals: string[];
  sampleMessages: string[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  userPersona: TestUserPersona;
  conversationTurns: number;
  evaluationCriteria: string[];
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export interface SimulationScore {
  memoryRecall: number;
  contextRelevance: number;
  entityExtraction: number;
  emotionalTone: number;
  overallScore: number;
}

export interface SimulationResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  conversation: ConversationTurn[];
  scores: SimulationScore | null;
  startedAt: string;
  completedAt: string | null;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  error?: string;
}

export interface SimulationState {
  isRunning: boolean;
  isStopping: boolean;
  currentScenarioIndex: number;
  results: SimulationResult[];
  totalScore: number;
  activeSimulationId: string | null;
}

export interface SimulationSummary {
  totalScenarios: number;
  completed: number;
  stopped: number;
  failed: number;
  avgScore: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
}

export interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

class SimulationServiceClient {
  private eventSource: EventSource | null = null;
  private eventCallbacks: Map<string, ((data: any) => void)[]> = new Map();

  /**
   * Get available personas
   */
  async getPersonas(): Promise<TestUserPersona[]> {
    const response = await api.get('/simulation/personas');
    return response.data.data;
  }

  /**
   * Get available scenarios
   */
  async getScenarios(): Promise<SimulationScenario[]> {
    const response = await api.get('/simulation/scenarios');
    return response.data.data;
  }

  /**
   * Get current state
   */
  async getState(): Promise<SimulationState> {
    const response = await api.get('/simulation/state');
    return response.data.data;
  }

  /**
   * Get all results with summary
   */
  async getResults(): Promise<{ results: SimulationResult[]; summary: SimulationSummary }> {
    const response = await api.get('/simulation/results');
    return response.data.data;
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<SimulationSummary> {
    const response = await api.get('/simulation/summary');
    return response.data.data;
  }

  /**
   * Run all scenarios
   */
  async runAll(): Promise<{ message: string }> {
    const response = await api.post('/simulation/run');
    return response.data;
  }

  /**
   * Run a specific scenario
   */
  async runScenario(scenarioId: string): Promise<{ message: string }> {
    const response = await api.post(`/simulation/run/${scenarioId}`);
    return response.data;
  }

  /**
   * Stop the currently running simulation
   */
  async stop(): Promise<{ stopped: boolean; message: string }> {
    const response = await api.post('/simulation/stop');
    return response.data.data;
  }

  /**
   * Clear all simulation data
   */
  async clearAll(): Promise<{ cleared: boolean; message: string }> {
    const response = await api.delete('/simulation/clear');
    return response.data.data;
  }

  /**
   * Connect to SSE events
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:6100/api/v1';
    this.eventSource = new EventSource(`${apiUrl}/simulation/events`);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        this.emit(data.type, data.data);
        this.emit('*', data); // Wildcard for all events
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Emit a plain string — the raw DOM Event is not renderable by React
      this.emit('error', { error: 'Live connection lost. Retrying…' });
    };
  }

  /**
   * Disconnect from SSE events
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.eventCallbacks.clear();
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to subscribers
   */
  private emit(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
}

export const simulationService = new SimulationServiceClient();
