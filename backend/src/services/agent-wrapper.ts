/**
 * Agent Wrapper Service
 *
 * Provides wrapper functions for all AI agent operations that track:
 * - Model output
 * - Token usage (input/output)
 * - Cost estimation
 *
 * Use these functions instead of calling agentService directly
 * when you need cost tracking.
 *
 * @module services/agent-wrapper
 *
 * @example
 * ```typescript
 * import { agentWrapper } from './services/agent-wrapper';
 *
 * const result = await agentWrapper.chat(message, context);
 * console.log(result.output);           // The AI response
 * console.log(result.tokenUsage);       // { input: 150, output: 200 }
 * console.log(result.costEstimate);     // { inputCost: 0.00024, outputCost: 0.00128, totalCost: 0.00152 }
 * ```
 */

import { qwenClient, selectModel } from '../config/qwen.js';
import { calculateCost, getModelPricing, MODEL_PRICING } from '../config/pricing.js';
import { ChatContext, ChatResponse, ExtractedEntities, FamilyTree } from '../models/types.js';
import { logger } from '../utils/logger.js';
import { withRetry, withCircuitBreaker, RetryOptions } from '../utils/retry.js';
import { ExternalApiError, logError } from '../utils/errors.js';

/**
 * Token usage information
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Cost estimation
 */
export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
}

/**
 * Agent response with usage tracking
 */
export interface AgentResponse<T> {
  output: T;
  model: string;
  tokenUsage: TokenUsage;
  costEstimate: CostEstimate;
  latencyMs: number;
}

/**
 * Default retry options
 */
const RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error: Error) => {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  },
};

const CIRCUITS = {
  EMBEDDING: 'qwen-embedding-wrapped',
  CHAT: 'qwen-chat-wrapped',
  EXTRACTION: 'qwen-extraction-wrapped',
};

/**
 * Estimate tokens for text (approximate: ~4 chars per token for English)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Derive suggested follow-up actions from a chat exchange.
 * Exported so streaming routes can reuse the same logic after the
 * full assistant response has been assembled.
 */
export function extractSuggestedActions(
  response: string,
  userMessage: string
): ChatResponse['suggestedActions'] {
  const actions: ChatResponse['suggestedActions'] = [];

  if (
    userMessage.toLowerCase().includes('told me') ||
    userMessage.toLowerCase().includes('said that') ||
    userMessage.toLowerCase().includes('remembered')
  ) {
    actions.push({ type: 'record_story', label: 'Save as a story' });
  }

  if (
    userMessage.toLowerCase().includes('when is') ||
    userMessage.toLowerCase().includes('birthday')
  ) {
    actions.push({ type: 'create_event', label: 'Set a reminder' });
  }

  return actions.length > 0 ? actions : undefined;
}

function formatFamilyTree(tree?: FamilyTree): string {
  if (!tree || tree.nodes.length === 0) {
    return '';
  }

  const nodeNames = new Map(tree.nodes.map((node) => [node.id, node.nickname || node.name]));
  const members = tree.nodes
    .map((node) => `- ${node.nickname || node.name}${node.isDeceased ? ' (deceased)' : ''}`)
    .join('\n');

  const relationships = tree.edges.length > 0
    ? tree.edges
        .map((edge) => {
          const from = nodeNames.get(edge.from) || edge.from;
          const to = nodeNames.get(edge.to) || edge.to;
          const relation = edge.relationship.toLowerCase().replaceAll('_', ' ');
          return `- ${from} ${relation} ${to}`;
        })
        .join('\n')
    : '- No explicit relationships recorded yet';

  return `\n\nFamily tree:\nMembers:\n${members}\nRelationships:\n${relationships}`;
}

/**
 * Agent Wrapper Class
 */
export class AgentWrapper {
  /**
   * Generate embeddings with usage tracking
   */
  async getEmbedding(text: string): Promise<AgentResponse<number[]>> {
    const model = selectModel('embed');
    const startTime = Date.now();

    const operation = async () => {
      const response = await qwenClient.embeddings.create({
        model,
        input: text,
      });
      return response;
    };

    try {
      const result = await withCircuitBreaker(
        () => withRetry(operation, { ...RETRY_OPTIONS, operationName: 'getEmbedding' }),
        { name: CIRCUITS.EMBEDDING, failureThreshold: 5, resetTimeout: 60000 }
      );

      const response = result.data;
      const embedding = response.data[0].embedding;
      const latencyMs = Date.now() - startTime;

      // Extract token usage from response or estimate
      const inputTokens = (response as any).usage?.prompt_tokens || estimateTokens(text);
      const outputTokens = 0; // Embeddings don't have output tokens

      const tokenUsage: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const costEstimate: CostEstimate = {
        ...calculateCost(model, inputTokens, outputTokens),
        currency: 'USD',
      };

      logger.debug({
        operation: 'getEmbedding',
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      }, 'Embedding generated with usage tracking');

      return {
        output: embedding,
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Embedding generation failed', {
        cause: error as Error,
        context: { operation: 'getEmbedding', metadata: { textLength: text.length } },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Chat completion with usage tracking
   */
  async chat(
    message: string,
    context: ChatContext
  ): Promise<AgentResponse<ChatResponse>> {
    const model = selectModel('chat');
    const startTime = Date.now();

    const systemPrompt = this.buildSystemPrompt(context);
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...context.history.slice(-10),
      { role: 'user' as const, content: message },
    ];

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });
      return response;
    };

    try {
      const result = await withCircuitBreaker(
        () => withRetry(operation, { ...RETRY_OPTIONS, operationName: 'chat' }),
        { name: CIRCUITS.CHAT, failureThreshold: 5, resetTimeout: 60000 }
      );

      const response = result.data;
      const assistantMessage = response.choices[0].message.content || '';
      const latencyMs = Date.now() - startTime;

      // Extract token usage from response
      const inputTokens = response.usage?.prompt_tokens ||
        estimateTokens(messages.map(m => m.content).join(' '));
      const outputTokens = response.usage?.completion_tokens ||
        estimateTokens(assistantMessage);

      const tokenUsage: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const costEstimate: CostEstimate = {
        ...calculateCost(model, inputTokens, outputTokens),
        currency: 'USD',
      };

      const chatResponse: ChatResponse = {
        response: assistantMessage,
        suggestedActions: this.extractSuggestedActions(assistantMessage, message),
      };

      logger.info({
        operation: 'chat',
        model,
        familyId: context.familyId,
        tokenUsage,
        costEstimate,
        latencyMs,
      }, 'Chat completed with usage tracking');

      return {
        output: chatResponse,
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Chat completion failed', {
        cause: error as Error,
        context: { operation: 'chat', metadata: { familyId: context.familyId } },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Streaming chat completion.
   *
   * Returns the raw OpenAI-SDK chunk stream (with usage reporting enabled via
   * stream_options) so the caller can relay deltas as they arrive. Spend is
   * NOT recorded here — the fetch-level accounting skips event-stream bodies,
   * so the caller must record spend once the stream completes (using the
   * final usage chunk, or estimateTokens(promptText/fullText) as a fallback).
   */
  async chatStream(message: string, context: ChatContext) {
    const model = selectModel('chat');
    const systemPrompt = this.buildSystemPrompt(context);
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...context.history.slice(-10),
      { role: 'user' as const, content: message },
    ];

    try {
      const stream = await qwenClient.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
        stream_options: { include_usage: true },
      });

      return {
        stream,
        model,
        promptText: messages.map((m) => m.content).join(' '),
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Chat stream failed', {
        cause: error as Error,
        context: { operation: 'chatStream', metadata: { familyId: context.familyId } },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Extract entities with usage tracking
   */
  async extractEntities(text: string): Promise<AgentResponse<ExtractedEntities>> {
    const model = selectModel('extract');
    const startTime = Date.now();

    const systemPrompt = `You are an entity extraction assistant for a family memory app. Extract:
1. People mentioned (names, nicknames, relationships like "grandma", "uncle")
2. Facts/preferences about people (e.g., "likes apple pie", "birthday is March 15")
3. Events with dates if mentioned
4. Locations mentioned

Rules for facts:
- Only extract facts from STATEMENTS. Never extract facts from questions or requests ("When is Joe's birthday?" contains no fact).
- Each fact must be a complete, self-contained statement (e.g., "birthday is March 15", never just "birthday").
- If the text contains no factual statements, return an empty facts array.

Return ONLY valid JSON in this exact format:
{
  "people": [{"name": "string", "relationship": "string or null", "attributes": ["string"]}],
  "facts": [{"about": "person name", "fact": "string", "confidence": 0.0-1.0}],
  "events": [{"title": "string", "date": "YYYY-MM-DD or null", "involves": ["person names"]}],
  "locations": ["string"]
}`;

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
      return response;
    };

    try {
      const result = await withCircuitBreaker(
        () => withRetry(operation, { ...RETRY_OPTIONS, operationName: 'extractEntities' }),
        { name: CIRCUITS.EXTRACTION, failureThreshold: 5, resetTimeout: 60000 }
      );

      const response = result.data;
      const content = response.choices[0].message.content || '{}';
      const entities = JSON.parse(content) as ExtractedEntities;
      const latencyMs = Date.now() - startTime;

      // Extract token usage
      const inputTokens = response.usage?.prompt_tokens ||
        estimateTokens(systemPrompt + text);
      const outputTokens = response.usage?.completion_tokens ||
        estimateTokens(content);

      const tokenUsage: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const costEstimate: CostEstimate = {
        ...calculateCost(model, inputTokens, outputTokens),
        currency: 'USD',
      };

      logger.debug({
        operation: 'extractEntities',
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
        entitiesFound: {
          people: entities.people?.length || 0,
          facts: entities.facts?.length || 0,
          events: entities.events?.length || 0,
          locations: entities.locations?.length || 0,
        },
      }, 'Entity extraction completed with usage tracking');

      return {
        output: entities,
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      };
    } catch (error) {
      logger.error({
        operation: 'extractEntities',
        error: (error as Error).message,
      }, 'Entity extraction failed');

      // Return empty result for graceful degradation
      return {
        output: { people: [], facts: [], events: [], locations: [] },
        model,
        tokenUsage: { input: 0, output: 0, total: 0 },
        costEstimate: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Summarize story with usage tracking
   */
  async summarizeStory(
    content: string
  ): Promise<AgentResponse<{ summary: string; mood: string; topics: string[] }>> {
    const model = selectModel('fast');
    const startTime = Date.now();

    const systemPrompt = `Summarize the family story in one sentence (max 100 chars). Also determine:
- mood: one of "happy", "sad", "nostalgic", "funny", "serious"
- topics: 2-5 keywords describing the story

Return ONLY valid JSON:
{"summary": "string", "mood": "string", "topics": ["string"]}`;

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
      return response;
    };

    try {
      const result = await withRetry(operation, {
        ...RETRY_OPTIONS,
        maxAttempts: 2,
        operationName: 'summarizeStory',
      });

      const response = result.data;
      const outputContent = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(outputContent);
      const latencyMs = Date.now() - startTime;

      const output = {
        summary: parsed.summary || 'A family story',
        mood: parsed.mood || 'nostalgic',
        topics: parsed.topics || [],
      };

      // Extract token usage
      const inputTokens = response.usage?.prompt_tokens ||
        estimateTokens(systemPrompt + content);
      const outputTokens = response.usage?.completion_tokens ||
        estimateTokens(outputContent);

      const tokenUsage: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const costEstimate: CostEstimate = {
        ...calculateCost(model, inputTokens, outputTokens),
        currency: 'USD',
      };

      logger.debug({
        operation: 'summarizeStory',
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      }, 'Story summarized with usage tracking');

      return {
        output,
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      };
    } catch (error) {
      logger.warn({
        operation: 'summarizeStory',
        error: (error as Error).message,
      }, 'Story summarization failed');

      return {
        output: { summary: 'A family story', mood: 'nostalgic', topics: [] },
        model,
        tokenUsage: { input: 0, output: 0, total: 0 },
        costEstimate: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Match people to family members with usage tracking
   */
  async matchPeopleToFamily(
    extractedPeople: ExtractedEntities['people'],
    familyMembers: { id: string; name: string; nickname?: string }[]
  ): Promise<AgentResponse<{ extractedName: string; matchedId: string | null; confidence: number }[]>> {
    const model = selectModel('fast');
    const startTime = Date.now();

    if (extractedPeople.length === 0) {
      return {
        output: [],
        model,
        tokenUsage: { input: 0, output: 0, total: 0 },
        costEstimate: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
        latencyMs: 0,
      };
    }

    const systemPrompt = `Match extracted names/relationships to family members. Consider nicknames and relationships.

Family members:
${familyMembers.map((m) => `- ID: ${m.id}, Name: ${m.name}${m.nickname ? `, Nickname: ${m.nickname}` : ''}`).join('\n')}

Return JSON array:
[{"extractedName": "string", "matchedId": "id or null", "confidence": 0.0-1.0}]`;

    const userContent = `Match these: ${JSON.stringify(extractedPeople.map((p) => p.name))}`;

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });
      return response;
    };

    try {
      const result = await withRetry(operation, {
        ...RETRY_OPTIONS,
        maxAttempts: 2,
        operationName: 'matchPeopleToFamily',
      });

      const response = result.data;
      const outputContent = response.choices[0].message.content || '[]';
      const parsed = JSON.parse(outputContent);
      const matches = Array.isArray(parsed) ? parsed : parsed.matches || [];
      const latencyMs = Date.now() - startTime;

      // Extract token usage
      const inputTokens = response.usage?.prompt_tokens ||
        estimateTokens(systemPrompt + userContent);
      const outputTokens = response.usage?.completion_tokens ||
        estimateTokens(outputContent);

      const tokenUsage: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const costEstimate: CostEstimate = {
        ...calculateCost(model, inputTokens, outputTokens),
        currency: 'USD',
      };

      logger.debug({
        operation: 'matchPeopleToFamily',
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
        matchesFound: matches.length,
      }, 'People matched with usage tracking');

      return {
        output: matches,
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      };
    } catch (error) {
      logger.warn({
        operation: 'matchPeopleToFamily',
        error: (error as Error).message,
      }, 'People matching failed');

      return {
        output: extractedPeople.map((p) => ({
          extractedName: p.name,
          matchedId: null,
          confidence: 0,
        })),
        model,
        tokenUsage: { input: 0, output: 0, total: 0 },
        costEstimate: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generic completion with usage tracking
   * Use this for custom prompts
   */
  async complete(
    systemPrompt: string,
    userPrompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<AgentResponse<string>> {
    const model = options.model || selectModel('chat');
    const startTime = Date.now();

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        ...(options.jsonMode && { response_format: { type: 'json_object' } }),
      });
      return response;
    };

    try {
      const result = await withRetry(operation, {
        ...RETRY_OPTIONS,
        operationName: 'complete',
      });

      const response = result.data;
      const content = response.choices[0].message.content || '';
      const latencyMs = Date.now() - startTime;

      // Extract token usage
      const inputTokens = response.usage?.prompt_tokens ||
        estimateTokens(systemPrompt + userPrompt);
      const outputTokens = response.usage?.completion_tokens ||
        estimateTokens(content);

      const tokenUsage: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const costEstimate: CostEstimate = {
        ...calculateCost(model, inputTokens, outputTokens),
        currency: 'USD',
      };

      logger.debug({
        operation: 'complete',
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      }, 'Completion with usage tracking');

      return {
        output: content,
        model,
        tokenUsage,
        costEstimate,
        latencyMs,
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Completion failed', {
        cause: error as Error,
        context: { operation: 'complete' },
      });
      logError(apiError);
      throw apiError;
    }
  }

  private buildSystemPrompt(context: ChatContext): string {
    const memoriesText =
      context.relevantMemories.length > 0
        ? `\n\nKnown facts about family members:\n${context.relevantMemories.map((m) => `- ${m.about.name}: ${m.fact}`).join('\n')}`
        : '';
    const familyTreeText = formatFamilyTree(context.familyTree);
    const memoryContextText = context.memoryContext?.trim()
      ? `\n\nSelected memory context:\n${context.memoryContext.trim()}`
      : '';
    const membersText =
      context.members && context.members.length > 0
        ? `\n\nMember profiles:\n${context.members
            .map((m) => {
              const parts = [m.name];
              if (m.nickname) parts.push(`(nickname "${m.nickname}")`);
              if (m.birthDate) parts.push(`— born ${m.birthDate}`);
              if (m.isDeceased) parts.push('(deceased)');
              return `- ${parts.join(' ')}`;
            })
            .join('\n')}`
        : '';
    const eventsText =
      context.upcomingEvents && context.upcomingEvents.length > 0
        ? `\n\nUpcoming family events:\n${context.upcomingEvents
            .map((e) => `- ${e.title} — ${e.date}${e.type ? ` (${e.type})` : ''}`)
            .join('\n')}`
        : '';
    const photosText =
      context.relevantPhotos && context.relevantPhotos.length > 0
        ? `\n\nRelevant family photos (these are being shown to the user below your reply — reference them naturally, e.g. "here's the photo from…"):\n${context.relevantPhotos
            .map((p) => {
              const who = (p.taggedMembers || []).map((m) => m.name).join(', ');
              return `- "${p.caption || 'Untitled'}"${who ? ` (with ${who})` : ''}${p.note ? ` — ${p.note}` : ''}`;
            })
            .join('\n')}`
        : '';

    return `You are a warm, helpful family memory assistant for the ${context.familyName} family.

You help family members:
- Recall stories and memories
- Remember facts about family members (birthdays, preferences, etc.)
- Suggest ways to stay connected
- Record new stories and memories

Current user: ${context.userName}
Family size: ${context.memberCount} members
Stories recorded: ${context.storyCount}
Facts remembered: ${context.memoryCount}
${membersText}
${eventsText}
${photosText}
${memoriesText}
${familyTreeText}
${memoryContextText}

Guidelines:
1. Treat the supplied family name and family tree as authoritative context.
2. Never invent a surname, relationship, or memory that is not present in the context.
3. Be warm and personal - use family members' names and nicknames
4. Reference specific stories and facts when relevant
5. If you don't know something, say so and encourage the user to record it
6. Suggest follow-up actions like "Would you like to record this as a story?"
7. Keep responses concise but heartfelt`;
  }

  private extractSuggestedActions(
    response: string,
    userMessage: string
  ): ChatResponse['suggestedActions'] {
    return extractSuggestedActions(response, userMessage);
  }
}

/**
 * Singleton instance
 */
export const agentWrapper = new AgentWrapper();

/**
 * Usage tracking aggregator
 * Call this to get cumulative usage for a session
 */
export class UsageTracker {
  private usage: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    requests: number;
    byModel: Record<string, { input: number; output: number; cost: number; requests: number }>;
  };

  constructor() {
    this.usage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      requests: 0,
      byModel: {},
    };
  }

  /**
   * Track usage from an agent response
   */
  track<T>(response: AgentResponse<T>): void {
    this.usage.totalInputTokens += response.tokenUsage.input;
    this.usage.totalOutputTokens += response.tokenUsage.output;
    this.usage.totalCost += response.costEstimate.totalCost;
    this.usage.requests++;

    if (!this.usage.byModel[response.model]) {
      this.usage.byModel[response.model] = { input: 0, output: 0, cost: 0, requests: 0 };
    }
    this.usage.byModel[response.model].input += response.tokenUsage.input;
    this.usage.byModel[response.model].output += response.tokenUsage.output;
    this.usage.byModel[response.model].cost += response.costEstimate.totalCost;
    this.usage.byModel[response.model].requests++;
  }

  /**
   * Get current usage summary
   */
  getSummary() {
    return {
      ...this.usage,
      totalTokens: this.usage.totalInputTokens + this.usage.totalOutputTokens,
    };
  }

  /**
   * Reset usage tracking
   */
  reset(): void {
    this.usage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      requests: 0,
      byModel: {},
    };
  }
}
