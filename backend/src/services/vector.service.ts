/**
 * Vector Service
 *
 * Handles all Qdrant vector database operations for semantic search.
 * This service manages:
 * - Indexing stories and memories as vector embeddings
 * - Semantic search across family content
 * - Vector deletion when content is removed
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Circuit breaker pattern to prevent cascade failures
 * - Comprehensive error handling and logging
 *
 * Uses Qwen's text-embedding-v3 model for 1536-dimensional embeddings.
 *
 * @module services/vector.service
 *
 * Collections:
 * - `stories`: Story content with metadata (author, family, topics, visibility)
 * - `memories`: Memory/fact content with metadata (about, family)
 *
 * @example
 * ```typescript
 * import { vectorService } from './services/vector.service';
 *
 * // Index a story
 * await vectorService.indexStory({
 *   id: 'story-123',
 *   content: 'Grandma bakes the best apple pie...',
 *   authorId: 'user-123',
 *   familyId: 'fam-456',
 *   topics: ['cooking', 'grandma'],
 * });
 *
 * // Search stories
 * const results = await vectorService.searchStories(
 *   'apple pie recipe',
 *   'fam-456',
 *   'user-123',
 *   5
 * );
 * ```
 */

import { getQdrantClient, COLLECTIONS } from '../config/qdrant.js';
import { agentService } from './agent.service.js';
import { EpisodicMemory, ProceduralMemory } from '../models/memory-types.js';
import { logger } from '../utils/logger.js';
import { withRetry, withCircuitBreaker, RetryOptions } from '../utils/retry.js';
import { DatabaseError, logError } from '../utils/errors.js';

/**
 * Default retry options for Qdrant operations.
 */
const QDRANT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error: Error) => {
    const message = error.message.toLowerCase();
    // Retry on connection errors and timeouts
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('unavailable') ||
      message.includes('503')
    );
  },
};

/**
 * Circuit breaker names.
 */
const CIRCUITS = {
  INDEX: 'qdrant-index',
  SEARCH: 'qdrant-search',
  DELETE: 'qdrant-delete',
};

/**
 * VectorService class for Qdrant operations.
 */
export class VectorService {
  /**
   * Indexes a story in the vector database for semantic search.
   *
   * Creates a vector embedding of the story content and stores it
   * with metadata for filtering (family, author, visibility).
   *
   * @param story - The story to index
   * @param story.id - Unique story identifier
   * @param story.content - Full story text
   * @param story.authorId - Author's user ID
   * @param story.familyId - Family the story belongs to
   * @param story.topics - AI-extracted topics
   * @param story.visibleTo - Optional list of user IDs who can see this story
   */
  async indexStory(story: {
    id: string;
    content: string;
    authorId: string;
    familyId: string;
    topics: string[];
    visibleTo?: string[];
  }): Promise<void> {
    const operation = async () => {
      const embedding = await agentService.getEmbedding(story.content);
      const client = getQdrantClient();

      await client.upsert(COLLECTIONS.STORIES, {
        points: [
          {
            id: story.id,
            vector: embedding,
            payload: {
              story_id: story.id,
              author_id: story.authorId,
              family_id: story.familyId,
              topics: story.topics,
              created_at: new Date().toISOString(),
              visible_to: story.visibleTo || [],
            },
          },
        ],
      });
    };

    try {
      await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'indexStory',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'indexStory',
                storyId: story.id,
                attempt,
                error: error.message,
                delay,
              }, `Story indexing retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.INDEX, failureThreshold: 5, resetTimeout: 60000 }
      );

      logger.debug({
        operation: 'indexStory',
        storyId: story.id,
        familyId: story.familyId,
      }, `Indexed story ${story.id}`);
    } catch (error) {
      const dbError = new DatabaseError('Failed to index story in vector database', error as Error, {
        operation: 'indexStory',
        metadata: { storyId: story.id, familyId: story.familyId },
      });
      logError(dbError);
      throw dbError;
    }
  }

  /**
   * Index a memory/fact in the vector database.
   */
  async indexMemory(memory: {
    id: string;
    fact: string;
    aboutId: string;
    familyId: string;
  }): Promise<void> {
    const operation = async () => {
      const embedding = await agentService.getEmbedding(memory.fact);
      const client = getQdrantClient();

      await client.upsert(COLLECTIONS.MEMORIES, {
        points: [
          {
            id: memory.id,
            vector: embedding,
            payload: {
              memory_id: memory.id,
              about_id: memory.aboutId,
              family_id: memory.familyId,
              created_at: new Date().toISOString(),
            },
          },
        ],
      });
    };

    try {
      await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'indexMemory',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'indexMemory',
                memoryId: memory.id,
                attempt,
                error: error.message,
                delay,
              }, `Memory indexing retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.INDEX, failureThreshold: 5, resetTimeout: 60000 }
      );

      logger.debug({
        operation: 'indexMemory',
        memoryId: memory.id,
        familyId: memory.familyId,
      }, `Indexed memory ${memory.id}`);
    } catch (error) {
      const dbError = new DatabaseError('Failed to index memory in vector database', error as Error, {
        operation: 'indexMemory',
        metadata: { memoryId: memory.id, familyId: memory.familyId },
      });
      logError(dbError);
      throw dbError;
    }
  }

  /**
   * Semantic search for stories.
   */
  async searchStories(
    query: string,
    familyId: string,
    userId: string,
    limit = 10
  ): Promise<{ storyId: string; relevance: number }[]> {
    const operation = async () => {
      const queryEmbedding = await agentService.getEmbedding(query);
      const client = getQdrantClient();

      const results = await client.search(COLLECTIONS.STORIES, {
        vector: queryEmbedding,
        filter: {
          must: [{ key: 'family_id', match: { value: familyId } }],
          should: [
            { is_empty: { key: 'visible_to' } },
            { key: 'visible_to', match: { value: userId } },
          ],
        },
        limit,
      });

      return results.map((r) => ({
        storyId: r.payload?.story_id as string,
        relevance: r.score,
      }));
    };

    try {
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'searchStories',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'searchStories',
                familyId,
                attempt,
                error: error.message,
                delay,
              }, `Story search retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.SEARCH, failureThreshold: 5, resetTimeout: 60000 }
      );

      return result.data;
    } catch (error) {
      // Log error but return empty results for graceful degradation
      logger.error({
        operation: 'searchStories',
        familyId,
        error: (error as Error).message,
      }, 'Story search failed, returning empty results');

      return [];
    }
  }

  /**
   * Semantic search for memories.
   */
  async searchMemories(
    query: string,
    familyId: string,
    limit = 10
  ): Promise<{ memoryId: string; relevance: number }[]> {
    const operation = async () => {
      const queryEmbedding = await agentService.getEmbedding(query);
      const client = getQdrantClient();

      const results = await client.search(COLLECTIONS.MEMORIES, {
        vector: queryEmbedding,
        filter: {
          must: [{ key: 'family_id', match: { value: familyId } }],
        },
        limit,
      });

      return results.map((r) => ({
        memoryId: r.payload?.memory_id as string,
        relevance: r.score,
      }));
    };

    try {
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'searchMemories',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'searchMemories',
                familyId,
                attempt,
                error: error.message,
                delay,
              }, `Memory search retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.SEARCH, failureThreshold: 5, resetTimeout: 60000 }
      );

      return result.data;
    } catch (error) {
      logger.error({
        operation: 'searchMemories',
        familyId,
        error: (error as Error).message,
      }, 'Memory search failed, returning empty results');

      return [];
    }
  }

  /**
   * Combined search across stories and memories.
   */
  async search(
    query: string,
    familyId: string,
    userId: string,
    types: ('stories' | 'memories')[] = ['stories', 'memories'],
    limit = 10
  ): Promise<{ type: 'story' | 'memory'; id: string; relevance: number }[]> {
    const results: { type: 'story' | 'memory'; id: string; relevance: number }[] = [];

    const searches = [];

    if (types.includes('stories')) {
      searches.push(
        this.searchStories(query, familyId, userId, limit).then((r) =>
          r.map((s) => ({ type: 'story' as const, id: s.storyId, relevance: s.relevance }))
        )
      );
    }

    if (types.includes('memories')) {
      searches.push(
        this.searchMemories(query, familyId, limit).then((r) =>
          r.map((m) => ({ type: 'memory' as const, id: m.memoryId, relevance: m.relevance }))
        )
      );
    }

    const searchResults = await Promise.all(searches);
    results.push(...searchResults.flat());

    // Sort by relevance and limit
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  }

  /**
   * Delete a story from the vector index.
   */
  async deleteStory(storyId: string): Promise<void> {
    const operation = async () => {
      const client = getQdrantClient();
      await client.delete(COLLECTIONS.STORIES, {
        points: [storyId],
      });
    };

    try {
      await withRetry(operation, {
        ...QDRANT_RETRY_OPTIONS,
        maxAttempts: 2, // Fewer retries for delete
        operationName: 'deleteStory',
      });

      logger.debug({
        operation: 'deleteStory',
        storyId,
      }, `Deleted story ${storyId} from index`);
    } catch (error) {
      // Log but don't throw - deletion failure shouldn't block other operations
      logger.error({
        operation: 'deleteStory',
        storyId,
        error: (error as Error).message,
      }, 'Failed to delete story from index');
    }
  }

  /**
   * Delete a memory from the vector index.
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const operation = async () => {
      const client = getQdrantClient();
      await client.delete(COLLECTIONS.MEMORIES, {
        points: [memoryId],
      });
    };

    try {
      await withRetry(operation, {
        ...QDRANT_RETRY_OPTIONS,
        maxAttempts: 2,
        operationName: 'deleteMemory',
      });

      logger.debug({
        operation: 'deleteMemory',
        memoryId,
      }, `Deleted memory ${memoryId} from index`);
    } catch (error) {
      logger.error({
        operation: 'deleteMemory',
        memoryId,
        error: (error as Error).message,
      }, 'Failed to delete memory from index');
    }
  }

  /**
   * Reindex all content for a family.
   * Useful for migrations or recovery.
   */
  async reindexFamily(
    familyId: string,
    stories: { id: string; content: string; authorId: string; topics: string[]; visibleTo?: string[] }[],
    memories: { id: string; fact: string; aboutId: string }[]
  ): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    logger.info({
      operation: 'reindexFamily',
      familyId,
      storyCount: stories.length,
      memoryCount: memories.length,
    }, `Starting reindex for family ${familyId}`);

    // Index stories
    for (const story of stories) {
      try {
        await this.indexStory({ ...story, familyId });
        indexed++;
      } catch (error) {
        failed++;
        logger.warn({
          operation: 'reindexFamily',
          storyId: story.id,
          error: (error as Error).message,
        }, 'Failed to reindex story');
      }
    }

    // Index memories
    for (const memory of memories) {
      try {
        await this.indexMemory({ ...memory, familyId });
        indexed++;
      } catch (error) {
        failed++;
        logger.warn({
          operation: 'reindexFamily',
          memoryId: memory.id,
          error: (error as Error).message,
        }, 'Failed to reindex memory');
      }
    }

    logger.info({
      operation: 'reindexFamily',
      familyId,
      indexed,
      failed,
    }, `Reindex complete for family ${familyId}: ${indexed} indexed, ${failed} failed`);

    return { indexed, failed };
  }

  // ============ EPISODIC MEMORY ============

  /**
   * Index an episodic memory for semantic search.
   */
  async indexEpisodicMemory(episode: EpisodicMemory): Promise<void> {
    const operation = async () => {
      const embedding = await agentService.getEmbedding(episode.content);
      const client = getQdrantClient();

      await client.upsert(COLLECTIONS.EPISODIC, {
        points: [
          {
            id: episode.id,
            vector: embedding,
            payload: {
              episode_id: episode.id,
              family_id: episode.familyId,
              session_id: episode.sessionId,
              event_type: episode.eventType,
              importance: episode.importance,
              consolidated: episode.consolidated,
              created_at: episode.createdAt.toISOString(),
            },
          },
        ],
      });
    };

    try {
      await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'indexEpisodicMemory',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'indexEpisodicMemory',
                episodeId: episode.id,
                attempt,
                error: error.message,
                delay,
              }, `Episodic memory indexing retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.INDEX, failureThreshold: 5, resetTimeout: 60000 }
      );

      logger.debug({
        operation: 'indexEpisodicMemory',
        episodeId: episode.id,
        familyId: episode.familyId,
      }, `Indexed episodic memory ${episode.id}`);
    } catch (error) {
      const dbError = new DatabaseError('Failed to index episodic memory', error as Error, {
        operation: 'indexEpisodicMemory',
        metadata: { episodeId: episode.id, familyId: episode.familyId },
      });
      logError(dbError);
      throw dbError;
    }
  }

  /**
   * Search episodic memories.
   */
  async searchEpisodicMemories(
    query: string,
    familyId: string,
    limit = 10,
    unconsolidatedOnly = false
  ): Promise<{ episodeId: string; relevance: number }[]> {
    const operation = async () => {
      const queryEmbedding = await agentService.getEmbedding(query);
      const client = getQdrantClient();

      const filter: any = {
        must: [{ key: 'family_id', match: { value: familyId } }],
      };

      if (unconsolidatedOnly) {
        filter.must.push({ key: 'consolidated', match: { value: false } });
      }

      const results = await client.search(COLLECTIONS.EPISODIC, {
        vector: queryEmbedding,
        filter,
        limit,
      });

      return results.map((r) => ({
        episodeId: r.payload?.episode_id as string,
        relevance: r.score,
      }));
    };

    try {
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'searchEpisodicMemories',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'searchEpisodicMemories',
                familyId,
                attempt,
                error: error.message,
                delay,
              }, `Episodic memory search retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.SEARCH, failureThreshold: 5, resetTimeout: 60000 }
      );

      return result.data;
    } catch (error) {
      logger.error({
        operation: 'searchEpisodicMemories',
        familyId,
        error: (error as Error).message,
      }, 'Episodic memory search failed, returning empty results');

      return [];
    }
  }

  /**
   * Delete an episodic memory from the index.
   */
  async deleteEpisodicMemory(episodeId: string): Promise<void> {
    const operation = async () => {
      const client = getQdrantClient();
      await client.delete(COLLECTIONS.EPISODIC, {
        points: [episodeId],
      });
    };

    try {
      await withRetry(operation, {
        ...QDRANT_RETRY_OPTIONS,
        maxAttempts: 2,
        operationName: 'deleteEpisodicMemory',
      });

      logger.debug({
        operation: 'deleteEpisodicMemory',
        episodeId,
      }, `Deleted episodic memory ${episodeId} from index`);
    } catch (error) {
      logger.error({
        operation: 'deleteEpisodicMemory',
        episodeId,
        error: (error as Error).message,
      }, 'Failed to delete episodic memory from index');
    }
  }

  // ============ PROCEDURAL MEMORY ============

  /**
   * Index a procedural memory (pattern) for semantic search.
   */
  async indexProceduralMemory(pattern: ProceduralMemory): Promise<void> {
    const operation = async () => {
      const textToEmbed = `${pattern.name}: ${pattern.description}. Trigger: ${pattern.trigger}. Action: ${pattern.action}`;
      const embedding = await agentService.getEmbedding(textToEmbed);
      const client = getQdrantClient();

      await client.upsert(COLLECTIONS.PROCEDURAL, {
        points: [
          {
            id: pattern.id,
            vector: embedding,
            payload: {
              pattern_id: pattern.id,
              family_id: pattern.familyId,
              pattern_type: pattern.patternType,
              name: pattern.name,
              confidence: pattern.confidence,
              created_at: pattern.createdAt.toISOString(),
            },
          },
        ],
      });
    };

    try {
      await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'indexProceduralMemory',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'indexProceduralMemory',
                patternId: pattern.id,
                attempt,
                error: error.message,
                delay,
              }, `Procedural memory indexing retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.INDEX, failureThreshold: 5, resetTimeout: 60000 }
      );

      logger.debug({
        operation: 'indexProceduralMemory',
        patternId: pattern.id,
        familyId: pattern.familyId,
      }, `Indexed procedural memory ${pattern.id}`);
    } catch (error) {
      const dbError = new DatabaseError('Failed to index procedural memory', error as Error, {
        operation: 'indexProceduralMemory',
        metadata: { patternId: pattern.id, familyId: pattern.familyId },
      });
      logError(dbError);
      throw dbError;
    }
  }

  /**
   * Search procedural memories.
   */
  async searchProceduralMemories(
    query: string,
    familyId: string,
    limit = 5
  ): Promise<{ patternId: string; relevance: number }[]> {
    const operation = async () => {
      const queryEmbedding = await agentService.getEmbedding(query);
      const client = getQdrantClient();

      const results = await client.search(COLLECTIONS.PROCEDURAL, {
        vector: queryEmbedding,
        filter: {
          must: [{ key: 'family_id', match: { value: familyId } }],
        },
        limit,
      });

      return results.map((r) => ({
        patternId: r.payload?.pattern_id as string,
        relevance: r.score,
      }));
    };

    try {
      const result = await withCircuitBreaker(
        () =>
          withRetry(operation, {
            ...QDRANT_RETRY_OPTIONS,
            operationName: 'searchProceduralMemories',
            onRetry: (attempt, error, delay) => {
              logger.warn({
                operation: 'searchProceduralMemories',
                familyId,
                attempt,
                error: error.message,
                delay,
              }, `Procedural memory search retry attempt ${attempt}`);
            },
          }),
        { name: CIRCUITS.SEARCH, failureThreshold: 5, resetTimeout: 60000 }
      );

      return result.data;
    } catch (error) {
      logger.error({
        operation: 'searchProceduralMemories',
        familyId,
        error: (error as Error).message,
      }, 'Procedural memory search failed, returning empty results');

      return [];
    }
  }

  /**
   * Delete a procedural memory from the index.
   */
  async deleteProceduralMemory(patternId: string): Promise<void> {
    const operation = async () => {
      const client = getQdrantClient();
      await client.delete(COLLECTIONS.PROCEDURAL, {
        points: [patternId],
      });
    };

    try {
      await withRetry(operation, {
        ...QDRANT_RETRY_OPTIONS,
        maxAttempts: 2,
        operationName: 'deleteProceduralMemory',
      });

      logger.debug({
        operation: 'deleteProceduralMemory',
        patternId,
      }, `Deleted procedural memory ${patternId} from index`);
    } catch (error) {
      logger.error({
        operation: 'deleteProceduralMemory',
        patternId,
        error: (error as Error).message,
      }, 'Failed to delete procedural memory from index');
    }
  }
}

export const vectorService = new VectorService();
