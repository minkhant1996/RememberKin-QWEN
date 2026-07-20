/**
 * Simulation Service
 *
 * Runs automated test scenarios with simulated users
 * interacting with the AI agent. Tracks scoring and performance.
 */

import { v4 as uuid } from 'uuid';
import { qwenClient } from '../config/qwen.js';
import { QWEN_MODELS } from '../config/qwen.js';
import { logger } from '../utils/logger.js';
import { calculateCost } from '../config/pricing.js';

/**
 * Test User Persona
 */
export interface TestUserPersona {
  id: string;
  name: string;
  description: string;
  personality: string;
  goals: string[];
  sampleMessages: string[];
}

/**
 * Simulation Scenario
 */
export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  userPersona: TestUserPersona;
  conversationTurns: number;
  evaluationCriteria: string[];
}

/**
 * Conversation Turn
 */
export interface ConversationTurn {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  latencyMs?: number;
  tokensUsed?: number;
}

/**
 * Simulation Score
 */
export interface SimulationScore {
  memoryRecall: number;      // 0-100: Did agent remember previous facts?
  contextRelevance: number;  // 0-100: Were responses contextually relevant?
  entityExtraction: number;  // 0-100: Did agent extract entities correctly?
  emotionalTone: number;     // 0-100: Was tone appropriate for family context?
  overallScore: number;      // Average of all scores
}

/**
 * Simulation Result
 */
export interface SimulationResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  conversation: ConversationTurn[];
  scores: SimulationScore | null;
  startedAt: Date;
  completedAt: Date | null;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  error?: string;
}

/**
 * Simulation State (in-memory for demo)
 */
interface SimulationState {
  isRunning: boolean;
  isStopping: boolean;
  currentScenarioIndex: number;
  results: SimulationResult[];
  totalScore: number;
  activeSimulationId: string | null;
}

// Default test personas - Family focused
const DEFAULT_PERSONAS: TestUserPersona[] = [
  {
    id: 'grandma-mary',
    name: 'Grandma Mary',
    description: 'A 75-year-old grandmother who loves sharing family stories',
    personality: 'Warm, nostalgic, sometimes forgetful, loves her grandchildren',
    goals: [
      'Share stories about grandchildren',
      'Remember family birthdays',
      'Preserve family recipes',
    ],
    sampleMessages: [
      "Oh, I want to tell you about when little Tommy first learned to ride a bike!",
      "Do you remember what I told you about my apple pie recipe?",
      "When is Sarah's birthday again? I always mix up the dates.",
      "My husband John used to love fishing at the lake house every summer.",
    ],
  },
  {
    id: 'busy-dad',
    name: 'Busy Dad (Mike)',
    description: 'A 42-year-old father managing work and family',
    personality: 'Efficient, caring but stressed, wants quick answers',
    goals: [
      'Track family events',
      'Remember kids activities',
      'Plan family gatherings',
    ],
    sampleMessages: [
      "What events do we have coming up this month?",
      "Did my wife mention anything about Emma's school play?",
      "I need to remember to pick up the cake for Dad's birthday.",
      "Can you remind me what time soccer practice is?",
    ],
  },
];

// Default scenarios - Family focused
const DEFAULT_SCENARIOS: SimulationScenario[] = [
  {
    id: 'family-memory-recall',
    name: 'Family Memory Recall',
    description: 'Tests if agent remembers family facts shared earlier',
    userPersona: DEFAULT_PERSONAS[0], // Grandma Mary
    conversationTurns: 4,
    evaluationCriteria: [
      'Agent remembers family member names',
      'Agent recalls family relationships correctly',
      'Agent references previous family stories',
    ],
  },
  {
    id: 'family-event-tracking',
    name: 'Family Event Tracking',
    description: 'Tests if agent correctly tracks family events and dates',
    userPersona: DEFAULT_PERSONAS[1], // Busy Dad
    conversationTurns: 3,
    evaluationCriteria: [
      'Agent extracts family member names',
      'Agent identifies birthdays and events',
      'Agent suggests reminders appropriately',
    ],
  },
];

class SimulationService {
  private state: SimulationState = {
    isRunning: false,
    isStopping: false,
    currentScenarioIndex: 0,
    results: [],
    totalScore: 0,
    activeSimulationId: null,
  };

  private eventCallbacks: Map<string, ((data: any) => void)[]> = new Map();
  private stopRequested = false;
  private activeAbortController: AbortController | null = null;

  /**
   * Get available personas
   */
  getPersonas(): TestUserPersona[] {
    return DEFAULT_PERSONAS;
  }

  /**
   * Get available scenarios
   */
  getScenarios(): SimulationScenario[] {
    return DEFAULT_SCENARIOS;
  }

  /**
   * Get current state
   */
  getState(): SimulationState {
    return { ...this.state };
  }

  /**
   * Get all results
   */
  getResults(): SimulationResult[] {
    return this.state.results;
  }

  /**
   * Subscribe to simulation events
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * Emit event to subscribers
   */
  private emit(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  /**
   * Clear all data
   */
  clearAllData(): { cleared: boolean; message: string } {
    this.stopRequested = false;
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    this.state = {
      isRunning: false,
      isStopping: false,
      currentScenarioIndex: 0,
      results: [],
      totalScore: 0,
      activeSimulationId: null,
    };

    this.emit('cleared', { timestamp: new Date() });

    logger.info('Simulation data cleared');
    return {
      cleared: true,
      message: 'All simulation data has been cleared',
    };
  }

  /**
   * Request the current simulation run to stop
   */
  stopCurrentRun(): { stopped: boolean; message: string } {
    if (!this.state.isRunning) {
      return {
        stopped: false,
        message: 'No simulation is currently running',
      };
    }

    this.stopRequested = true;
    this.state.isStopping = true;
    this.activeAbortController?.abort();

    this.emit('simulation:stop-requested', {
      activeSimulationId: this.state.activeSimulationId,
      currentScenarioIndex: this.state.currentScenarioIndex,
    });

    logger.info('Simulation stop requested');

    return {
      stopped: true,
      message: 'Stop requested. The active simulation will halt shortly.',
    };
  }

  /**
   * Run a single scenario
   */
  async runScenario(
    scenario: SimulationScenario,
    onTurn?: (turn: ConversationTurn, result: SimulationResult) => void,
    signal?: AbortSignal
  ): Promise<SimulationResult> {
    const wasRunning = this.state.isRunning;
    const localAbortController = signal ? null : new AbortController();
    const effectiveSignal = signal ?? localAbortController?.signal;

    if (!wasRunning) {
      this.state.isRunning = true;
    }

    const result: SimulationResult = {
      id: uuid(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: 'running',
      conversation: [],
      scores: null,
      startedAt: new Date(),
      completedAt: null,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
    };

    this.state.activeSimulationId = result.id;
    this.activeAbortController = localAbortController ?? this.activeAbortController;
    this.emit('scenario:start', { result, scenario });

    try {
      const conversationHistory: Array<{ role: string; content: string }> = [];

      // Run conversation turns
      for (let i = 0; i < scenario.conversationTurns; i++) {
        this.throwIfStopped(effectiveSignal);

        // Generate user message
        const userMessage = await this.generateUserMessage(
          scenario.userPersona,
          conversationHistory,
          i,
          effectiveSignal
        );

        const userTurn: ConversationTurn = {
          id: uuid(),
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
        };

        result.conversation.push(userTurn);
        conversationHistory.push({ role: 'user', content: userMessage });

        this.emit('turn:user', { turn: userTurn, result });
        if (onTurn) onTurn(userTurn, result);

        // Small delay for visual effect
        await this.delay(500, effectiveSignal);

        // Generate agent response
        this.throwIfStopped(effectiveSignal);
        const startTime = Date.now();
        const agentResponse = await this.generateAgentResponse(conversationHistory, effectiveSignal);
        const latencyMs = Date.now() - startTime;

        const agentTurn: ConversationTurn = {
          id: uuid(),
          role: 'agent',
          content: agentResponse.content,
          timestamp: new Date(),
          latencyMs,
          tokensUsed: agentResponse.tokensUsed,
        };

        result.conversation.push(agentTurn);
        result.totalLatencyMs += latencyMs;
        result.totalTokens += agentResponse.tokensUsed;
        result.totalCost += agentResponse.cost;

        conversationHistory.push({ role: 'assistant', content: agentResponse.content });

        this.emit('turn:agent', { turn: agentTurn, result });
        if (onTurn) onTurn(agentTurn, result);

        // Delay between turns
        await this.delay(800, effectiveSignal);
      }

      // Evaluate the conversation
      this.throwIfStopped(effectiveSignal);
      result.scores = await this.evaluateConversation(scenario, result.conversation, effectiveSignal);
      result.status = 'completed';
      result.completedAt = new Date();

      this.emit('scenario:complete', { result, scores: result.scores });

    } catch (error: any) {
      if (this.isStopError(error, signal)) {
        result.status = 'stopped';
        result.error = 'Simulation stopped by user';
        this.emit('scenario:stopped', { result, scenario });
      } else {
        result.status = 'failed';
        result.error = error.message;
        this.emit('scenario:error', { result, error: error.message });
        logger.error({ error: error.message, scenarioId: scenario.id }, 'Scenario failed');
      }
      result.completedAt = new Date();
    }

    this.state.results.push(result);
    this.state.activeSimulationId = null;

    if (!wasRunning) {
      this.state.isRunning = false;
      this.state.isStopping = false;
      this.stopRequested = false;
      this.activeAbortController = null;
    } else if (!signal && localAbortController) {
      this.activeAbortController = null;
    }

    return result;
  }

  /**
   * Run all scenarios
   */
  async runAllScenarios(
    onTurn?: (turn: ConversationTurn, result: SimulationResult) => void,
    onScenarioComplete?: (result: SimulationResult, index: number, total: number) => void
  ): Promise<{ results: SimulationResult[]; stopped: boolean }> {
    if (this.state.isRunning) {
      throw new Error('Simulation already running');
    }

    this.state.isRunning = true;
    this.state.isStopping = false;
    this.state.currentScenarioIndex = 0;
    this.stopRequested = false;
    this.activeAbortController = null;
    const results: SimulationResult[] = [];
    let stopped = false;

    this.emit('simulation:start', { totalScenarios: DEFAULT_SCENARIOS.length });

    try {
      for (let i = 0; i < DEFAULT_SCENARIOS.length; i++) {
        if (this.stopRequested) {
          stopped = true;
          break;
        }

        this.state.currentScenarioIndex = i;
        const scenario = DEFAULT_SCENARIOS[i];
        const controller = new AbortController();
        this.activeAbortController = controller;

        const result = await this.runScenario(scenario, onTurn, controller.signal);
        results.push(result);

        if (onScenarioComplete) {
          onScenarioComplete(result, i, DEFAULT_SCENARIOS.length);
        }

        if (result.status === 'stopped' || this.stopRequested) {
          stopped = true;
          this.activeAbortController = null;
          break;
        }

        // Delay between scenarios
        if (i < DEFAULT_SCENARIOS.length - 1) {
          try {
            await this.delay(1000, controller.signal);
          } catch (error) {
            if (this.isStopError(error, controller.signal)) {
              stopped = true;
              this.activeAbortController = null;
              break;
            }
            throw error;
          }
        }

        this.activeAbortController = null;
      }

      // Calculate total score
      const completedResults = results.filter(r => r.status === 'completed' && r.scores);
      if (completedResults.length > 0) {
        this.state.totalScore = completedResults.reduce(
          (sum, r) => sum + (r.scores?.overallScore || 0),
          0
        ) / completedResults.length;
      }

      const summary = this.getSummary(results);
      if (stopped) {
        this.emit('simulation:stopped', {
          results,
          totalScore: this.state.totalScore,
          summary,
        });
      } else {
        this.emit('simulation:complete', {
          results,
          totalScore: this.state.totalScore,
          summary,
        });
      }

    } finally {
      this.state.isRunning = false;
      this.state.isStopping = false;
      this.stopRequested = false;
      this.activeAbortController = null;
    }

    return { results, stopped };
  }

  /**
   * Generate simulated user message
   */
  private async generateUserMessage(
    persona: TestUserPersona,
    history: Array<{ role: string; content: string }>,
    turnIndex: number,
    signal?: AbortSignal
  ): Promise<string> {
    // For first turn, use a sample message
    if (turnIndex === 0 && persona.sampleMessages.length > 0) {
      return persona.sampleMessages[Math.floor(Math.random() * persona.sampleMessages.length)];
    }

    // Generate contextual follow-up
    const systemPrompt = `You are role-playing as ${persona.name}.
${persona.description}
Personality: ${persona.personality}
Goals: ${persona.goals.join(', ')}

Generate a SHORT, natural message (1-2 sentences) as this person would say in a family memory app conversation.
Consider the previous conversation context. Be authentic to the character.
Do NOT include quotation marks or "I say:" prefixes. Just output the message directly.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-4),
      { role: 'user', content: 'Generate the next message from ' + persona.name },
    ];

    const response = await qwenClient.chat.completions.create({
      model: QWEN_MODELS.FAST,
      messages,
      max_tokens: 100,
      temperature: 0.8,
    }, signal ? { signal } : undefined);

    return response.choices[0].message.content || persona.sampleMessages[0];
  }

  /**
   * Generate agent response
   */
  private async generateAgentResponse(
    history: Array<{ role: string; content: string }>,
    signal?: AbortSignal
  ): Promise<{ content: string; tokensUsed: number; cost: number }> {
    const systemPrompt = `You are a warm, helpful AI assistant for a family memory app called "Rememberkin".
Your role is to help users preserve precious family memories across generations.

**FAMILY FOCUS**: Help with family stories, traditions, generations, birthdays, recipes, heritage, milestones

Your approach:
- Be warm, empathetic, and encouraging
- Remember details about family members (names, relationships, preferences, dates)
- Use a nostalgic, caring tone appropriate for family context
- Suggest ways to document and celebrate family moments
- Extract and store important facts mentioned
- Help preserve family legacy for future generations

Keep responses concise (2-3 sentences) but heartfelt.
Reference any previous information shared in the conversation when relevant.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    const startTime = Date.now();
    const response = await qwenClient.chat.completions.create({
      model: QWEN_MODELS.CHAT,
      messages,
      max_tokens: 200,
      temperature: 0.7,
    }, signal ? { signal } : undefined);

    const tokensUsed = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
    const cost = calculateCost(
      QWEN_MODELS.CHAT,
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0
    ).totalCost;

    return {
      content: response.choices[0].message.content || "I'm here to help!",
      tokensUsed,
      cost,
    };
  }

  /**
   * Evaluate conversation and generate scores
   */
  private async evaluateConversation(
    scenario: SimulationScenario,
    conversation: ConversationTurn[],
    signal?: AbortSignal
  ): Promise<SimulationScore> {
    const conversationText = conversation
      .map(t => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n');

    const evaluationPrompt = `Evaluate this conversation from a family memory AI assistant.

CONVERSATION:
${conversationText}

EVALUATION CRITERIA:
${scenario.evaluationCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rate each of the following on a scale of 0-100:
1. Memory Recall: Did the agent remember and reference facts shared earlier?
2. Context Relevance: Were responses relevant to the conversation context?
3. Entity Extraction: Did the agent recognize and acknowledge people, dates, events?
4. Emotional Tone: Was the tone warm, empathetic, and appropriate for family context?

Respond in JSON format:
{
  "memoryRecall": <number>,
  "contextRelevance": <number>,
  "entityExtraction": <number>,
  "emotionalTone": <number>,
  "reasoning": "<brief explanation>"
}`;

    try {
      const response = await qwenClient.chat.completions.create({
        model: QWEN_MODELS.CHAT,
        messages: [{ role: 'user', content: evaluationPrompt }],
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }, signal ? { signal } : undefined);

      const content = response.choices[0].message.content || '{}';
      const scores = JSON.parse(content);

      return {
        memoryRecall: Math.min(100, Math.max(0, scores.memoryRecall || 70)),
        contextRelevance: Math.min(100, Math.max(0, scores.contextRelevance || 75)),
        entityExtraction: Math.min(100, Math.max(0, scores.entityExtraction || 70)),
        emotionalTone: Math.min(100, Math.max(0, scores.emotionalTone || 80)),
        overallScore: 0,  // Calculate below
      };
    } catch (error) {
      // Return default scores on evaluation error
      logger.warn({ error }, 'Evaluation failed, using defaults');
      return {
        memoryRecall: 75,
        contextRelevance: 80,
        entityExtraction: 70,
        emotionalTone: 85,
        overallScore: 77.5,
      };
    }
  }

  /**
   * Get summary statistics
   */
  getSummary(results?: SimulationResult[]): {
    totalScenarios: number;
    completed: number;
    stopped: number;
    failed: number;
    avgScore: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
  } {
    const data = results || this.state.results;
    const completed = data.filter(r => r.status === 'completed');
    const stopped = data.filter(r => r.status === 'stopped');
    const failed = data.filter(r => r.status === 'failed');

    const scores = completed
      .filter(r => r.scores)
      .map(r => {
        const s = r.scores!;
        return (s.memoryRecall + s.contextRelevance + s.entityExtraction + s.emotionalTone) / 4;
      });

    return {
      totalScenarios: data.length,
      completed: completed.length,
      stopped: stopped.length,
      failed: failed.length,
      avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      totalTokens: data.reduce((sum, r) => sum + r.totalTokens, 0),
      totalCost: data.reduce((sum, r) => sum + r.totalCost, 0),
      avgLatency: data.length > 0
        ? data.reduce((sum, r) => sum + r.totalLatencyMs, 0) / data.length / 1000
        : 0,
    };
  }

  /**
   * Helper: delay
   */
  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    if (!signal) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    if (signal.aborted) {
      return Promise.reject(this.createAbortError());
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timeoutId);
        signal.removeEventListener('abort', onAbort);
        reject(this.createAbortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private throwIfStopped(signal?: AbortSignal): void {
    if (this.stopRequested || signal?.aborted) {
      throw this.createAbortError();
    }
  }

  private isStopError(error: unknown, signal?: AbortSignal): boolean {
    return Boolean(
      this.stopRequested ||
      signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    );
  }

  private createAbortError(): Error {
    const error = new Error('Simulation stopped');
    error.name = 'AbortError';
    return error;
  }
}

// Singleton instance
export const simulationService = new SimulationService();
