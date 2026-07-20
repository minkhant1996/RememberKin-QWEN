/**
 * Agent Service
 *
 * Provides AI-powered features using the Qwen Cloud API.
 * This service handles:
 * - Text embeddings for semantic search (1536-dimensional vectors)
 * - Conversational chat with family context
 * - Entity extraction (people, facts, events, locations)
 * - Story summarization and mood/topic classification
 * - People-to-family member matching
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Circuit breaker pattern to prevent cascade failures
 * - Comprehensive error handling and logging
 *
 * @module services/agent.service
 *
 * @example
 * ```typescript
 * import { agentService } from './services/agent.service';
 *
 * // Get embedding for semantic search
 * const embedding = await agentService.getEmbedding('grandma loves apple pie');
 *
 * // Chat with context
 * const response = await agentService.chat('Tell me about grandma', context);
 *
 * // Extract entities from story
 * const entities = await agentService.extractEntities(storyContent);
 * ```
 */

import { qwenClient, QWEN_MODELS, selectModel } from '../config/qwen.js';
import { ChatContext, ChatResponse, ExtractedEntities, FamilyTree } from '../models/types.js';
import { logger } from '../utils/logger.js';
import { withRetry, withCircuitBreaker, RetryOptions } from '../utils/retry.js';
import { ExternalApiError, wrapError, logError } from '../utils/errors.js';

/**
 * Default retry options for Qwen API calls.
 */
const QWEN_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error: Error) => {
    const message = error.message.toLowerCase();
    // Retry on rate limits, network errors, and 5xx errors
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  },
};

/**
 * Circuit breaker names for different operations.
 */
const CIRCUITS = {
  EMBEDDING: 'qwen-embedding',
  CHAT: 'qwen-chat',
  EXTRACTION: 'qwen-extraction',
};

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
 * AgentService class for Qwen AI operations.
 *
 * Uses two Qwen models:
 * - `text-embedding-v3`: For generating 1536-dimensional embeddings
 * - `qwen-plus`: For chat and reasoning tasks
 * - `qwen-turbo`: For fast, simple tasks
 */
export class AgentService {
  /**
   * Generates a 1536-dimensional embedding vector for text.
   * Used for semantic search in Qdrant vector database.
   *
   * Features:
   * - Automatic retry on transient failures
   * - Circuit breaker to prevent cascade failures
   *
   * @param text - The text to embed
   * @returns Array of 1536 floats representing the embedding
   * @throws ExternalApiError if the API call fails after retries
   *
   * @example
   * ```typescript
   * const embedding = await agentService.getEmbedding('grandma bakes cookies');
   * // Returns: [0.0123, -0.0456, 0.0789, ...]
   * ```
   */
  async getEmbedding(text: string): Promise<number[]> {
    const operation = async () => {
      const response = await qwenClient.embeddings.create({
        model: selectModel('embed'), // text-embedding-v3
        input: text,
      });
      return response.data[0].embedding;
    };

    try {
      // Apply circuit breaker first, then retry logic
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QWEN_RETRY_OPTIONS,
            operationName: 'getEmbedding',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'getEmbedding',
                attempt,
                error: error.message,
                delay,
              }, `Embedding API retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.EMBEDDING, failureThreshold: 5, resetTimeout: 60000 }
      );

      return result.data;
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Embedding generation failed', {
        cause: error as Error,
        context: {
          operation: 'getEmbedding',
          metadata: { textLength: text.length },
        },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Processes a chat message with family context and returns an AI response.
   *
   * The chat function:
   * 1. Builds a system prompt with family context
   * 2. Includes conversation history (last 10 messages)
   * 3. Generates a contextual response
   * 4. Extracts suggested actions from the response
   *
   * @param message - The user's message
   * @param context - Family context including name, members, and relevant memories
   * @returns ChatResponse with the AI message and optional suggested actions
   *
   * @example
   * ```typescript
   * const response = await agentService.chat('When is grandma birthday?', {
   *   familyId: 'fam-123',
   *   familyName: 'Smith Family',
   *   userName: 'John',
   *   memberCount: 5,
   *   storyCount: 20,
   *   memoryCount: 100,
   *   relevantMemories: [...],
   *   history: [...]
   * });
   * ```
   */
  async chat(message: string, context: ChatContext): Promise<ChatResponse> {
    const systemPrompt = this.buildSystemPrompt(context);

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model: selectModel('chat'), // qwen-max for best reasoning
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.history.slice(-10), // Last 10 messages for context
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response.choices[0].message.content || '';
    };

    try {
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QWEN_RETRY_OPTIONS,
            operationName: 'chat',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'chat',
                attempt,
                error: error.message,
                delay,
                familyId: context.familyId,
              }, `Chat API retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.CHAT, failureThreshold: 5, resetTimeout: 60000 }
      );

      const assistantMessage = result.data;

      return {
        response: assistantMessage,
        suggestedActions: this.extractSuggestedActions(assistantMessage, message),
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Chat completion failed', {
        cause: error as Error,
        context: {
          operation: 'chat',
          metadata: {
            familyId: context.familyId,
            messageLength: message.length,
          },
        },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Extracts structured entities from unstructured text.
   *
   * Identifies:
   * - People: Names and references to family members
   * - Facts: Preferences, traits, biographical information
   * - Events: Dates, occasions, milestones
   * - Locations: Places mentioned in the text
   *
   * @param text - The story or conversation text to analyze
   * @returns ExtractedEntities with categorized information
   *
   * @example
   * ```typescript
   * const entities = await agentService.extractEntities(
   *   "Grandma Rose baked apple pie every Sunday at her house in Boston"
   * );
   * // Returns:
   * // {
   * //   people: ["Grandma Rose"],
   * //   facts: [{ fact: "bakes apple pie every Sunday", about: "Grandma Rose", confidence: 0.95 }],
   * //   events: [],
   * //   locations: ["Boston"]
   * // }
   * ```
   */
  async extractEntities(text: string): Promise<ExtractedEntities> {
    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model: selectModel('extract'), // qwq-plus for better reasoning
        messages: [
          {
            role: 'system',
            content: `You are an entity extraction assistant for a family memory app. Extract:
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
}`,
          },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content);
    };

    try {
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QWEN_RETRY_OPTIONS,
            operationName: 'extractEntities',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'extractEntities',
                attempt,
                error: error.message,
                delay,
              }, `Entity extraction retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.EXTRACTION, failureThreshold: 5, resetTimeout: 60000 }
      );

      return result.data;
    } catch (error) {
      // Log error but return empty result for graceful degradation
      logger.error({
        operation: 'extractEntities',
        error: (error as Error).message,
      }, 'Entity extraction failed, returning empty result');

      return { people: [], facts: [], events: [], locations: [] };
    }
  }

  /**
   * Summarize a story and extract mood/topics.
   */
  async summarizeStory(content: string): Promise<{ summary: string; mood: string; topics: string[] }> {
    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model: selectModel('fast'), // qwen-flash for speed
        messages: [
          {
            role: 'system',
            content: `Summarize the family story in one sentence (max 100 chars). Also determine:
- mood: one of "happy", "sad", "nostalgic", "funny", "serious"
- topics: 2-5 keywords describing the story

Return ONLY valid JSON:
{"summary": "string", "mood": "string", "topics": ["string"]}`,
          },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        summary: result.summary || 'A family story',
        mood: result.mood || 'nostalgic',
        topics: result.topics || [],
      };
    };

    try {
      const result = await withRetry(operation, {
        ...QWEN_RETRY_OPTIONS,
        maxAttempts: 2, // Fewer retries for non-critical operation
        operationName: 'summarizeStory',
      });

      return result.data;
    } catch (error) {
      logger.warn({
        operation: 'summarizeStory',
        error: (error as Error).message,
      }, 'Story summarization failed, using defaults');

      return { summary: 'A family story', mood: 'nostalgic', topics: [] };
    }
  }

  /**
   * Match mentioned names to family members.
   */
  async matchPeopleToFamily(
    extractedPeople: ExtractedEntities['people'],
    familyMembers: { id: string; name: string; nickname?: string }[]
  ): Promise<{ extractedName: string; matchedId: string | null; confidence: number }[]> {
    if (extractedPeople.length === 0) return [];

    const operation = async () => {
      const response = await qwenClient.chat.completions.create({
        model: selectModel('fast'), // qwen-flash for speed
        messages: [
          {
            role: 'system',
            content: `Match extracted names/relationships to family members. Consider nicknames and relationships.

Family members:
${familyMembers.map((m) => `- ID: ${m.id}, Name: ${m.name}${m.nickname ? `, Nickname: ${m.nickname}` : ''}`).join('\n')}

Return JSON array:
[{"extractedName": "string", "matchedId": "id or null", "confidence": 0.0-1.0}]`,
          },
          {
            role: 'user',
            content: `Match these: ${JSON.stringify(extractedPeople.map((p) => p.name))}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0].message.content || '[]';
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : parsed.matches || [];
    };

    try {
      const result = await withRetry(operation, {
        ...QWEN_RETRY_OPTIONS,
        maxAttempts: 2,
        operationName: 'matchPeopleToFamily',
      });

      return result.data;
    } catch (error) {
      logger.warn({
        operation: 'matchPeopleToFamily',
        error: (error as Error).message,
        extractedCount: extractedPeople.length,
      }, 'People matching failed, returning unmatched');

      return extractedPeople.map((p) => ({
        extractedName: p.name,
        matchedId: null,
        confidence: 0,
      }));
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
    const actions: ChatResponse['suggestedActions'] = [];

    // Check if the conversation suggests recording something
    if (
      userMessage.toLowerCase().includes('told me') ||
      userMessage.toLowerCase().includes('said that') ||
      userMessage.toLowerCase().includes('remembered')
    ) {
      actions.push({
        type: 'record_story',
        label: 'Save as a story',
      });
    }

    // Check if asking about someone
    if (
      userMessage.toLowerCase().includes('when is') ||
      userMessage.toLowerCase().includes('birthday')
    ) {
      actions.push({
        type: 'create_event',
        label: 'Set a reminder',
      });
    }

    return actions.length > 0 ? actions : undefined;
  }
}

export const agentService = new AgentService();
