/**
 * Memory Service
 *
 * Implements a 4-layer cognitive memory system:
 * 1. Working Memory - Ephemeral, session-scoped
 * 2. Episodic Memory - Short-term episodes
 * 3. Semantic Memory - Long-term facts
 * 4. Procedural Memory - Learned patterns
 *
 * @module services/memory.service
 */

import { v4 as uuid } from 'uuid';
import {
  WorkingMemory,
  PendingFact,
  ActiveEntity,
  EpisodicMemory,
  CreateEpisodicInput,
  EpisodicQueryOptions,
  SemanticMemory,
  CreateSemanticInput,
  SemanticQueryOptions,
  ProceduralMemory,
  CreateProceduralInput,
  MemoryStats,
  MemoryActivity,
  CreateActivityInput,
  ConsolidationCandidate,
  ConsolidationResult,
  DetectedPattern,
  PatternDetectionResult,
  FactType,
} from '../models/memory-types.js';
import { graphService } from './graph.service.js';
import { vectorService } from './vector.service.js';
import { agentService } from './agent.service.js';
import { logger } from '../utils/logger.js';

// In-memory working memory store (could be Redis in production)
const workingMemoryStore = new Map<string, WorkingMemory>();

// Configuration constants
const CONFIG = {
  // Working Memory TTL (in milliseconds)
  WORKING_MEMORY_TTL: 30 * 60 * 1000, // 30 minutes
  PENDING_FACT_TTL: 10 * 60 * 1000,   // 10 minutes

  // Context Window Management
  MAX_CONTEXT_TOKENS: 4000,           // Max tokens for context
  MAX_ATTENTION_WINDOW: 10,           // Max items in attention window
  SUMMARIZE_THRESHOLD: 2000,          // Start summarizing after this many tokens

  // Decay & Forgetting
  MIN_CONFIDENCE_THRESHOLD: 0.15,     // Below this, memory is deleted
  DECAY_RATE_PER_DAY: 0.02,           // Daily confidence decay
  EPISODIC_TTL_DAYS: 30,              // Days before episodic cleanup
  MAX_EPISODIC_MEMORIES: 100,         // Max episodic memories per family

  // Consolidation
  MIN_MENTIONS_FOR_CONSOLIDATION: 1,
  CONFIDENCE_BOOST_PER_MENTION: 0.05,
};

/**
 * Estimate token count for text (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * MemoryService class for managing the 4-layer memory system.
 */
export class MemoryService {
  // ==================== WORKING MEMORY ====================

  /**
   * Get or create working memory for a session.
   */
  getOrCreateWorkingMemory(sessionId: string, familyId: string, userId: string): WorkingMemory {
    const key = `${familyId}:${sessionId}`;

    if (!workingMemoryStore.has(key)) {
      const workingMemory: WorkingMemory = {
        sessionId,
        familyId,
        userId,
        currentTopics: [],
        activeEntities: [],
        pendingFacts: [],
        attentionWindow: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      workingMemoryStore.set(key, workingMemory);
    }

    return workingMemoryStore.get(key)!;
  }

  /**
   * Get working memory for a family (all sessions).
   */
  getWorkingMemory(familyId: string): WorkingMemory | null {
    // Return the most recent working memory for the family
    let mostRecent: WorkingMemory | null = null;

    for (const [key, wm] of workingMemoryStore) {
      if (key.startsWith(`${familyId}:`)) {
        if (!mostRecent || wm.updatedAt > mostRecent.updatedAt) {
          mostRecent = wm;
        }
      }
    }

    return mostRecent;
  }

  /**
   * Get all working memories for a family.
   */
  getAllWorkingMemories(familyId: string): WorkingMemory[] {
    const memories: WorkingMemory[] = [];

    for (const [key, wm] of workingMemoryStore) {
      if (key.startsWith(`${familyId}:`)) {
        memories.push(wm);
      }
    }

    return memories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Add a pending fact to working memory.
   */
  addPendingFact(
    sessionId: string,
    familyId: string,
    userId: string,
    fact: string,
    aboutName: string,
    aboutId?: string,
    confidence: number = 0.8,
    extractedFrom: string = 'conversation'
  ): PendingFact {
    const wm = this.getOrCreateWorkingMemory(sessionId, familyId, userId);

    const pendingFact: PendingFact = {
      id: uuid(),
      fact,
      aboutId,
      aboutName,
      confidence,
      extractedFrom,
      extractedAt: new Date(),
    };

    wm.pendingFacts.push(pendingFact);
    wm.updatedAt = new Date();

    return pendingFact;
  }

  /**
   * Add or update an active entity in working memory.
   */
  addActiveEntity(
    sessionId: string,
    familyId: string,
    userId: string,
    entity: { id: string; name: string; type: ActiveEntity['type'] }
  ): void {
    const wm = this.getOrCreateWorkingMemory(sessionId, familyId, userId);

    const existing = wm.activeEntities.find(e => e.id === entity.id);
    if (existing) {
      existing.mentionCount++;
      existing.lastMentioned = new Date();
    } else {
      wm.activeEntities.push({
        ...entity,
        mentionCount: 1,
        lastMentioned: new Date(),
      });
    }

    wm.updatedAt = new Date();
  }

  /**
   * Clear working memory for a session.
   */
  clearWorkingMemory(sessionId: string, familyId: string): void {
    const key = `${familyId}:${sessionId}`;
    workingMemoryStore.delete(key);
  }

  /**
   * TIMELY FORGETTING: Clean up expired working memory items.
   * Removes stale sessions and expired pending facts.
   */
  cleanupWorkingMemory(familyId: string): { sessionsRemoved: number; factsRemoved: number } {
    const now = Date.now();
    let sessionsRemoved = 0;
    let factsRemoved = 0;

    const keysToDelete: string[] = [];

    for (const [key, wm] of workingMemoryStore) {
      if (!key.startsWith(`${familyId}:`)) continue;

      const sessionAge = now - wm.updatedAt.getTime();

      // Remove entire session if too old
      if (sessionAge > CONFIG.WORKING_MEMORY_TTL) {
        keysToDelete.push(key);
        sessionsRemoved++;
        factsRemoved += wm.pendingFacts.length;
        continue;
      }

      // Remove old pending facts within active sessions
      const originalCount = wm.pendingFacts.length;
      wm.pendingFacts = wm.pendingFacts.filter(pf => {
        const factAge = now - pf.extractedAt.getTime();
        return factAge < CONFIG.PENDING_FACT_TTL;
      });
      factsRemoved += originalCount - wm.pendingFacts.length;

      // Remove old entities from attention
      wm.activeEntities = wm.activeEntities.filter(e => {
        const entityAge = now - e.lastMentioned.getTime();
        return entityAge < CONFIG.WORKING_MEMORY_TTL;
      });

      // Trim attention window to max size
      if (wm.attentionWindow.length > CONFIG.MAX_ATTENTION_WINDOW) {
        wm.attentionWindow = wm.attentionWindow.slice(-CONFIG.MAX_ATTENTION_WINDOW);
      }
    }

    // Delete expired sessions
    keysToDelete.forEach(key => workingMemoryStore.delete(key));

    if (sessionsRemoved > 0 || factsRemoved > 0) {
      logger.debug({
        operation: 'cleanupWorkingMemory',
        familyId,
        sessionsRemoved,
        factsRemoved,
      }, 'Working memory cleanup complete');
    }

    return { sessionsRemoved, factsRemoved };
  }

  /**
   * Update attention window with current context item.
   */
  updateAttentionWindow(
    sessionId: string,
    familyId: string,
    userId: string,
    item: string
  ): void {
    const wm = this.getOrCreateWorkingMemory(sessionId, familyId, userId);

    // Add to attention window
    wm.attentionWindow.push(item);

    // Keep only the most recent items
    if (wm.attentionWindow.length > CONFIG.MAX_ATTENTION_WINDOW) {
      wm.attentionWindow = wm.attentionWindow.slice(-CONFIG.MAX_ATTENTION_WINDOW);
    }

    wm.updatedAt = new Date();
  }

  // ==================== CONTEXT WINDOW MANAGEMENT ====================

  /**
   * Get optimized context for chat, respecting token limits.
   * Uses importance-based selection and summarization.
   */
  async getOptimizedContext(
    familyId: string,
    query: string,
    maxTokens: number = CONFIG.MAX_CONTEXT_TOKENS
  ): Promise<{
    context: string;
    tokenCount: number;
    memoriesUsed: number;
    wasTruncated: boolean;
  }> {
    let totalTokens = 0;
    const contextParts: string[] = [];
    let memoriesUsed = 0;
    let wasTruncated = false;

    // 1. Get relevant semantic memories (most important)
    const semanticMemories = await this.getSemanticMemories(familyId, {
      minConfidence: 0.3,
      limit: 20,
    });

    // Sort by confidence * decay factor (effective strength)
    const rankedMemories = semanticMemories
      .map(m => ({
        ...m,
        effectiveStrength: m.confidence * (m.decayFactor || 1),
      }))
      .sort((a, b) => b.effectiveStrength - a.effectiveStrength);

    // Add high-confidence memories first
    for (const memory of rankedMemories) {
      const memoryText = `- ${memory.aboutName}: ${memory.fact}`;
      const tokens = estimateTokens(memoryText);

      if (totalTokens + tokens > maxTokens * 0.6) { // Reserve 40% for other context
        wasTruncated = true;
        break;
      }

      contextParts.push(memoryText);
      totalTokens += tokens;
      memoriesUsed++;
    }

    // 2. Get recent episodic summaries if space allows
    if (totalTokens < maxTokens * 0.8) {
      const episodes = await this.getEpisodicMemories(familyId, {
        limit: 5,
        sortBy: 'importance',
        sortOrder: 'desc',
      });

      for (const ep of episodes) {
        // Use summary instead of full content for efficiency
        const summary = ep.summary || ep.content.slice(0, 100);
        const epText = `[Episode] ${summary}`;
        const tokens = estimateTokens(epText);

        if (totalTokens + tokens > maxTokens * 0.9) {
          wasTruncated = true;
          break;
        }

        contextParts.push(epText);
        totalTokens += tokens;
      }
    }

    // 3. Add procedural patterns if relevant
    if (totalTokens < maxTokens) {
      const patterns = await this.getProceduralMemories(familyId);
      for (const pattern of patterns.slice(0, 3)) {
        const patternText = `[Pattern] ${pattern.name}: ${pattern.description}`;
        const tokens = estimateTokens(patternText);

        if (totalTokens + tokens > maxTokens) {
          wasTruncated = true;
          break;
        }

        contextParts.push(patternText);
        totalTokens += tokens;
      }
    }

    return {
      context: contextParts.join('\n'),
      tokenCount: totalTokens,
      memoriesUsed,
      wasTruncated,
    };
  }

  /**
   * Summarize old episodic memories to save space.
   */
  async summarizeEpisodicMemories(familyId: string): Promise<number> {
    const episodes = await this.getEpisodicMemories(familyId, {
      consolidated: false,
      limit: 50,
    });

    let summarized = 0;
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    for (const ep of episodes) {
      const epDate = new Date(ep.createdAt);

      // Only summarize old episodes without summaries
      if (epDate < cutoffDate && !ep.summary && ep.content.length > 200) {
        // Create a simple summary (first 100 chars + key facts)
        const summary = ep.content.slice(0, 100) +
          (ep.extractedFacts.length > 0 ? ` [${ep.extractedFacts.length} facts]` : '');

        await graphService.updateEpisodicMemory(ep.id, { summary });
        summarized++;
      }
    }

    return summarized;
  }

  // ==================== TIMELY FORGETTING ====================

  /**
   * TIMELY FORGETTING: Prune low-confidence memories.
   * Deletes memories below the minimum confidence threshold.
   */
  async pruneWeakMemories(familyId: string): Promise<{
    semanticPruned: number;
    episodicPruned: number;
  }> {
    let semanticPruned = 0;
    let episodicPruned = 0;

    // Prune semantic memories below threshold
    const semanticMemories = await this.getSemanticMemories(familyId, {
      minConfidence: 0, // Get all
      limit: 1000,
    });

    for (const memory of semanticMemories) {
      const effectiveConfidence = memory.confidence * (memory.decayFactor || 1);

      if (effectiveConfidence < CONFIG.MIN_CONFIDENCE_THRESHOLD) {
        await graphService.deleteSemanticMemory(memory.id);
        semanticPruned++;

        await this.logActivity({
          familyId,
          type: 'decayed',
          description: `Pruned weak memory: "${memory.fact}" (${Math.round(effectiveConfidence * 100)}%)`,
          fromLayer: 'semantic',
        });
      }
    }

    // Prune old episodic memories
    const cutoffDate = new Date(Date.now() - CONFIG.EPISODIC_TTL_DAYS * 24 * 60 * 60 * 1000);
    const oldEpisodes = await this.getEpisodicMemories(familyId, {
      consolidated: true, // Only prune if already consolidated
      limit: 1000,
    });

    for (const ep of oldEpisodes) {
      const epDate = new Date(ep.createdAt);

      // Delete old, consolidated, low-access episodes
      if (epDate < cutoffDate && ep.accessCount < 2 && ep.importance < 0.5) {
        await graphService.deleteEpisodicMemory(ep.id);
        episodicPruned++;
      }
    }

    if (semanticPruned > 0 || episodicPruned > 0) {
      logger.info({
        operation: 'pruneWeakMemories',
        familyId,
        semanticPruned,
        episodicPruned,
      }, 'Weak memories pruned');
    }

    return { semanticPruned, episodicPruned };
  }

  /**
   * TIMELY FORGETTING: Apply age-based decay to semantic memories.
   * Older memories lose confidence over time unless reinforced.
   */
  async applyAgingDecay(familyId: string): Promise<number> {
    const memories = await this.getSemanticMemories(familyId, { limit: 1000 });
    const now = new Date();
    let decayedCount = 0;

    for (const memory of memories) {
      const lastReinforced = new Date(memory.lastReinforced);
      const daysSinceReinforcement = (now.getTime() - lastReinforced.getTime()) / (24 * 60 * 60 * 1000);

      // Only decay if not recently reinforced
      if (daysSinceReinforcement > 1) {
        const decayAmount = Math.min(
          CONFIG.DECAY_RATE_PER_DAY * daysSinceReinforcement,
          0.2 // Cap decay at 20% per cycle
        );

        const newDecayFactor = Math.max(
          (memory.decayFactor || 1) - decayAmount,
          0.1 // Don't decay below 10%
        );

        if (newDecayFactor !== memory.decayFactor) {
          await graphService.updateSemanticMemory(memory.id, {
            decayFactor: newDecayFactor,
          });
          decayedCount++;
        }
      }
    }

    return decayedCount;
  }

  /**
   * TIMELY FORGETTING: Enforce maximum episodic memory limit.
   * Removes oldest, least important memories when limit exceeded.
   */
  async enforceEpisodicLimit(familyId: string): Promise<number> {
    const episodes = await this.getEpisodicMemories(familyId, {
      limit: CONFIG.MAX_EPISODIC_MEMORIES + 50, // Get extra to see if over limit
      sortBy: 'createdAt',
      sortOrder: 'asc', // Oldest first
    });

    if (episodes.length <= CONFIG.MAX_EPISODIC_MEMORIES) {
      return 0;
    }

    // Score episodes by importance + access + recency
    const scored = episodes.map(ep => {
      const now = Date.now();
      const ageMs = now - new Date(ep.createdAt).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      const recencyScore = Math.max(0, 1 - ageDays / 30); // 0-1 based on 30 days

      return {
        ...ep,
        score: ep.importance * 0.4 + (ep.accessCount / 10) * 0.3 + recencyScore * 0.3,
      };
    });

    // Sort by score (lowest first = candidates for deletion)
    scored.sort((a, b) => a.score - b.score);

    // Delete lowest-scored episodes until under limit
    const toDelete = scored.slice(0, episodes.length - CONFIG.MAX_EPISODIC_MEMORIES);
    let deleted = 0;

    for (const ep of toDelete) {
      await graphService.deleteEpisodicMemory(ep.id);
      deleted++;
    }

    if (deleted > 0) {
      logger.info({
        operation: 'enforceEpisodicLimit',
        familyId,
        deleted,
        remaining: episodes.length - deleted,
      }, 'Episodic memory limit enforced');
    }

    return deleted;
  }

  /**
   * Run full memory maintenance (cleanup + decay + prune).
   * Should be called periodically (e.g., daily or after each conversation).
   */
  async runMaintenance(familyId: string): Promise<{
    workingCleanup: { sessionsRemoved: number; factsRemoved: number };
    agingDecay: number;
    pruned: { semanticPruned: number; episodicPruned: number };
    episodicEnforced: number;
    summarized: number;
  }> {
    logger.debug({ operation: 'runMaintenance', familyId }, 'Starting memory maintenance');

    const workingCleanup = this.cleanupWorkingMemory(familyId);
    const agingDecay = await this.applyAgingDecay(familyId);
    const pruned = await this.pruneWeakMemories(familyId);
    const episodicEnforced = await this.enforceEpisodicLimit(familyId);
    const summarized = await this.summarizeEpisodicMemories(familyId);

    const result = {
      workingCleanup,
      agingDecay,
      pruned,
      episodicEnforced,
      summarized,
    };

    logger.info({
      operation: 'runMaintenance',
      familyId,
      ...result,
    }, 'Memory maintenance complete');

    return result;
  }

  // ==================== CONVERSATION PROCESSING ====================

  /**
   * Process a conversation turn - extract facts and update working memory.
   */
  async processConversation(
    sessionId: string,
    userMessage: string,
    assistantResponse: string,
    familyId: string,
    userId: string
  ): Promise<{ extractedFacts: PendingFact[]; activityLog: MemoryActivity[] }> {
    const activities: MemoryActivity[] = [];
    const extractedFacts: PendingFact[] = [];

    try {
      // Get family members for matching
      const familyMembers = await graphService.getFamilyMembers(familyId);

      // Extract entities from the user message
      const entities = await agentService.extractEntities(userMessage);

      // Match extracted people to family members
      const matches = await agentService.matchPeopleToFamily(
        entities.people,
        familyMembers.map(m => ({ id: m.id, name: m.name, nickname: m.nickname }))
      );

      // Process extracted facts
      for (const fact of entities.facts) {
        // Guard against fragment "facts" (e.g. bare "birthday" extracted from a question)
        if (!fact.fact || fact.fact.trim().split(/\s+/).length < 3) {
          continue;
        }

        // Find matched person
        const match = matches.find(m =>
          m.extractedName.toLowerCase() === fact.about.toLowerCase()
        );

        const pendingFact = this.addPendingFact(
          sessionId,
          familyId,
          userId,
          fact.fact,
          fact.about,
          match?.matchedId || undefined,
          fact.confidence,
          'conversation'
        );

        extractedFacts.push(pendingFact);

        // Log activity
        const activity = await this.logActivity({
          familyId,
          type: 'extracted',
          description: `Extracted: "${fact.fact}" about ${fact.about}`,
          toLayer: 'working',
          memoryFact: fact.fact,
          confidence: fact.confidence,
        });
        activities.push(activity);
      }

      // Update active entities
      for (const match of matches) {
        if (match.matchedId) {
          this.addActiveEntity(sessionId, familyId, userId, {
            id: match.matchedId,
            name: match.extractedName,
            type: 'person',
          });
        }
      }

      // Create episodic memory for this conversation turn
      if (extractedFacts.length > 0 || userMessage.length > 50) {
        await this.createEpisodicMemory({
          familyId,
          sessionId,
          eventType: 'conversation',
          content: `User: ${userMessage}\nAssistant: ${assistantResponse}`,
          summary: userMessage.slice(0, 100),
          participants: matches.filter(m => m.matchedId).map(m => m.matchedId!),
          extractedFacts: extractedFacts.map(f => f.fact),
        });
      }

      logger.debug({
        operation: 'processConversation',
        sessionId,
        familyId,
        extractedFactsCount: extractedFacts.length,
      }, 'Processed conversation');

    } catch (error) {
      logger.error({
        operation: 'processConversation',
        error: (error as Error).message,
        sessionId,
        familyId,
      }, 'Failed to process conversation');
    }

    return { extractedFacts, activityLog: activities };
  }

  // ==================== EPISODIC MEMORY ====================

  /**
   * Create an episodic memory entry.
   */
  async createEpisodicMemory(input: CreateEpisodicInput): Promise<EpisodicMemory> {
    const episode = await graphService.createEpisodicMemory({
      ...input,
      emotionalValence: input.emotionalValence ?? 0,
      importance: input.importance ?? this.calculateImportance(input),
    });

    // Index in vector database for semantic search
    try {
      await vectorService.indexEpisodicMemory(episode);
    } catch (error) {
      logger.warn({
        operation: 'createEpisodicMemory',
        episodeId: episode.id,
        error: (error as Error).message,
      }, 'Failed to index episodic memory');
    }

    // Log activity
    await this.logActivity({
      familyId: input.familyId,
      type: 'episode_created',
      description: `Episode created: ${input.eventType}`,
      toLayer: 'episodic',
      memoryId: episode.id,
    });

    return episode;
  }

  /**
   * Calculate importance score for an episode.
   */
  private calculateImportance(input: CreateEpisodicInput): number {
    let importance = 0.5; // Base importance

    // More participants = more important
    if (input.participants && input.participants.length > 0) {
      importance += Math.min(input.participants.length * 0.1, 0.2);
    }

    // More extracted facts = more important
    if (input.extractedFacts && input.extractedFacts.length > 0) {
      importance += Math.min(input.extractedFacts.length * 0.1, 0.2);
    }

    // Story events are more important
    if (input.eventType === 'story_added') {
      importance += 0.1;
    }

    // Cap at 1.0
    return Math.min(importance, 1.0);
  }

  /**
   * Get episodic memories for a family.
   */
  async getEpisodicMemories(familyId: string, options: EpisodicQueryOptions = {}): Promise<EpisodicMemory[]> {
    return graphService.getEpisodicMemories(familyId, options);
  }

  /**
   * Mark episodic memory as accessed (for recall tracking).
   */
  async accessEpisodicMemory(episodeId: string): Promise<void> {
    await graphService.accessEpisodicMemory(episodeId);
  }

  // ==================== SEMANTIC MEMORY ====================

  /**
   * Create a semantic memory (consolidated fact).
   */
  async createSemanticMemory(input: CreateSemanticInput): Promise<SemanticMemory> {
    // Check for existing similar memory
    const existing = await graphService.findSimilarSemanticMemory(
      input.familyId,
      input.fact,
      input.aboutId
    );

    if (existing) {
      // Reinforce existing memory
      await this.reinforceMemory(existing.id);
      return existing;
    }

    const memory = await graphService.createSemanticMemory(input);

    // Index in vector database
    try {
      await vectorService.indexMemory({
        id: memory.id,
        fact: memory.fact,
        aboutId: memory.aboutId,
        familyId: memory.familyId,
      });
    } catch (error) {
      logger.warn({
        operation: 'createSemanticMemory',
        memoryId: memory.id,
        error: (error as Error).message,
      }, 'Failed to index semantic memory');
    }

    return memory;
  }

  /**
   * Get semantic memories for a family.
   */
  async getSemanticMemories(familyId: string, options: SemanticQueryOptions = {}): Promise<SemanticMemory[]> {
    return graphService.getSemanticMemories(familyId, options);
  }

  /**
   * Reinforce a memory (increase confidence).
   */
  async reinforceMemory(memoryId: string): Promise<void> {
    const memory = await graphService.reinforceSemanticMemory(memoryId);

    if (memory) {
      await this.logActivity({
        familyId: memory.familyId,
        type: 'reinforced',
        description: `Memory reinforced: "${memory.fact}"`,
        fromLayer: 'semantic',
        toLayer: 'semantic',
        memoryId: memory.id,
        memoryFact: memory.fact,
        confidence: memory.confidence,
      });
    }
  }

  /**
   * Apply decay to memories (reduce confidence over time).
   */
  async applyDecay(familyId: string, decayAmount: number = 0.01): Promise<number> {
    const decayedCount = await graphService.applyDecayToMemories(familyId, decayAmount);

    if (decayedCount > 0) {
      await this.logActivity({
        familyId,
        type: 'decayed',
        description: `Decay applied to ${decayedCount} memories`,
        fromLayer: 'semantic',
        toLayer: 'semantic',
      });
    }

    return decayedCount;
  }

  // ==================== PROCEDURAL MEMORY ====================

  /**
   * Create a procedural memory (learned pattern).
   */
  async createProceduralMemory(input: CreateProceduralInput): Promise<ProceduralMemory> {
    const pattern = await graphService.createProceduralMemory(input);

    // Index in vector database
    try {
      await vectorService.indexProceduralMemory(pattern);
    } catch (error) {
      logger.warn({
        operation: 'createProceduralMemory',
        patternId: pattern.id,
        error: (error as Error).message,
      }, 'Failed to index procedural memory');
    }

    await this.logActivity({
      familyId: input.familyId,
      type: 'pattern_detected',
      description: `Pattern detected: ${input.name}`,
      toLayer: 'procedural',
      memoryId: pattern.id,
    });

    return pattern;
  }

  /**
   * Get procedural memories for a family.
   */
  async getProceduralMemories(familyId: string): Promise<ProceduralMemory[]> {
    return graphService.getProceduralMemories(familyId);
  }

  // ==================== CONSOLIDATION ====================

  /**
   * Get candidates for consolidation.
   */
  async getConsolidationCandidates(familyId: string): Promise<ConsolidationCandidate[]> {
    // Get pending facts from working memory
    const workingMemories = this.getAllWorkingMemories(familyId);
    const candidates: ConsolidationCandidate[] = [];

    // Group pending facts by fact content
    const factGroups = new Map<string, { fact: PendingFact; count: number; totalConfidence: number }>();

    for (const wm of workingMemories) {
      for (const pf of wm.pendingFacts) {
        const key = `${pf.aboutName}:${pf.fact}`;
        if (factGroups.has(key)) {
          const group = factGroups.get(key)!;
          group.count++;
          group.totalConfidence += pf.confidence;
        } else {
          factGroups.set(key, { fact: pf, count: 1, totalConfidence: pf.confidence });
        }
      }
    }

    // Convert to candidates
    for (const [_, group] of factGroups) {
      const avgConfidence = group.totalConfidence / group.count;

      candidates.push({
        episodeId: group.fact.id, // Using fact ID as reference
        fact: group.fact.fact,
        aboutId: group.fact.aboutId || '',
        aboutName: group.fact.aboutName,
        mentionCount: group.count,
        totalImportance: avgConfidence * group.count,
        suggestedConfidence: Math.min(avgConfidence + (group.count - 1) * 0.05, 1.0),
        factType: this.inferFactType(group.fact.fact),
      });
    }

    // Sort by total importance
    return candidates.sort((a, b) => b.totalImportance - a.totalImportance);
  }

  /**
   * Infer the fact type from the fact content.
   */
  private inferFactType(fact: string): FactType {
    const lowerFact = fact.toLowerCase();

    if (lowerFact.includes('likes') || lowerFact.includes('loves') ||
        lowerFact.includes('prefers') || lowerFact.includes('favorite')) {
      return 'preference';
    }
    if (lowerFact.includes('born') || lowerFact.includes('birthday') ||
        lowerFact.includes('age') || lowerFact.includes('lives')) {
      return 'biographical';
    }
    if (lowerFact.includes('married') || lowerFact.includes('sibling') ||
        lowerFact.includes('parent') || lowerFact.includes('child')) {
      return 'relationship';
    }
    if (lowerFact.includes('always') || lowerFact.includes('usually') ||
        lowerFact.includes('every')) {
      return 'routine';
    }

    return 'trait';
  }

  /**
   * Consolidate memories from working/episodic to semantic.
   */
  async consolidateMemories(familyId: string): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      processed: 0,
      consolidated: 0,
      reinforced: 0,
      skipped: 0,
      newSemanticMemories: [],
      reinforcedMemories: [],
      activities: [],
    };

    const candidates = await this.getConsolidationCandidates(familyId);

    for (const candidate of candidates) {
      result.processed++;

      // Skip if no aboutId (can't link to a person)
      if (!candidate.aboutId) {
        result.skipped++;
        continue;
      }

      // Check for existing similar memory
      const existing = await graphService.findSimilarSemanticMemory(
        familyId,
        candidate.fact,
        candidate.aboutId
      );

      if (existing) {
        // Reinforce existing
        await this.reinforceMemory(existing.id);
        result.reinforced++;
        result.reinforcedMemories.push(existing.id);

        const activity = await this.logActivity({
          familyId,
          type: 'reinforced',
          description: `Reinforced: "${candidate.fact}" about ${candidate.aboutName}`,
          fromLayer: 'working',
          toLayer: 'semantic',
          memoryId: existing.id,
          memoryFact: candidate.fact,
          confidence: existing.confidence,
        });
        result.activities.push(activity);
      } else {
        // Create new semantic memory
        const newMemory = await this.createSemanticMemory({
          familyId,
          factType: candidate.factType,
          fact: candidate.fact,
          aboutId: candidate.aboutId,
          aboutName: candidate.aboutName,
          confidence: candidate.suggestedConfidence,
        });

        result.consolidated++;
        result.newSemanticMemories.push(newMemory);

        const activity = await this.logActivity({
          familyId,
          type: 'consolidated',
          description: `Consolidated: "${candidate.fact}" about ${candidate.aboutName}`,
          fromLayer: 'working',
          toLayer: 'semantic',
          memoryId: newMemory.id,
          memoryFact: candidate.fact,
          confidence: newMemory.confidence,
        });
        result.activities.push(activity);
      }
    }

    // Clear consolidated facts from working memory
    for (const wm of this.getAllWorkingMemories(familyId)) {
      wm.pendingFacts = wm.pendingFacts.filter(pf =>
        !candidates.some(c => c.fact === pf.fact && c.aboutName === pf.aboutName)
      );
    }

    logger.info({
      operation: 'consolidateMemories',
      familyId,
      ...result,
    }, 'Memory consolidation complete');

    return result;
  }

  // ==================== PATTERN DETECTION ====================

  /**
   * Detect patterns from episodic memories.
   */
  async detectPatterns(familyId: string): Promise<PatternDetectionResult> {
    const result: PatternDetectionResult = {
      patternsFound: 0,
      newPatterns: [],
      reinforcedPatterns: [],
    };

    try {
      // Get recent episodic memories
      const episodes = await this.getEpisodicMemories(familyId, {
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Analyze for patterns using AI
      if (episodes.length >= 3) {
        const patternAnalysis = await this.analyzeForPatterns(episodes);

        for (const detected of patternAnalysis) {
          // Check if pattern already exists
          const existing = await graphService.findSimilarProceduralMemory(
            familyId,
            detected.trigger
          );

          if (existing) {
            await graphService.reinforceProceduralMemory(existing.id);
            result.reinforcedPatterns.push(existing.id);
          } else if (detected.confidence >= 0.6) {
            const pattern = await this.createProceduralMemory({
              familyId,
              patternType: detected.patternType,
              name: detected.name,
              description: detected.description,
              trigger: detected.trigger,
              action: detected.action,
              appliesToIds: detected.appliesToIds,
            });

            result.newPatterns.push(pattern);
            result.patternsFound++;
          }
        }
      }
    } catch (error) {
      logger.error({
        operation: 'detectPatterns',
        familyId,
        error: (error as Error).message,
      }, 'Pattern detection failed');
    }

    return result;
  }

  /**
   * Use AI to analyze episodes for patterns.
   */
  private async analyzeForPatterns(episodes: EpisodicMemory[]): Promise<DetectedPattern[]> {
    // Simple pattern detection based on recurring facts/topics
    const patterns: DetectedPattern[] = [];
    const factCounts = new Map<string, { count: number; episodes: string[]; participants: string[] }>();

    for (const ep of episodes) {
      for (const fact of ep.extractedFacts) {
        const key = fact.toLowerCase();
        if (factCounts.has(key)) {
          const entry = factCounts.get(key)!;
          entry.count++;
          entry.episodes.push(ep.id);
          entry.participants.push(...ep.participants);
        } else {
          factCounts.set(key, {
            count: 1,
            episodes: [ep.id],
            participants: [...ep.participants],
          });
        }
      }
    }

    // Create patterns from recurring facts
    for (const [fact, data] of factCounts) {
      if (data.count >= 2) {
        const uniqueParticipants = [...new Set(data.participants)];

        patterns.push({
          patternType: 'preference_cluster',
          name: `Recurring: ${fact.slice(0, 50)}`,
          description: `This fact has been mentioned ${data.count} times across ${data.episodes.length} episodes`,
          trigger: 'conversation about similar topic',
          action: `recall: ${fact}`,
          confidence: Math.min(0.5 + data.count * 0.15, 0.95),
          supportingEpisodes: data.episodes,
          appliesToIds: uniqueParticipants,
        });
      }
    }

    return patterns;
  }

  // ==================== ACTIVITY LOGGING ====================

  /**
   * Log a memory activity.
   */
  async logActivity(input: CreateActivityInput): Promise<MemoryActivity> {
    return graphService.logMemoryActivity(input);
  }

  /**
   * Get recent activity for a family.
   */
  async getRecentActivity(familyId: string, limit: number = 20): Promise<MemoryActivity[]> {
    return graphService.getMemoryActivity(familyId, limit);
  }

  // ==================== STATISTICS ====================

  /**
   * Get memory statistics for dashboard.
   */
  async getMemoryStats(familyId: string): Promise<MemoryStats> {
    // Working memory stats
    const workingMemories = this.getAllWorkingMemories(familyId);
    let pendingFactsCount = 0;
    let activeEntitiesCount = 0;

    for (const wm of workingMemories) {
      pendingFactsCount += wm.pendingFacts.length;
      activeEntitiesCount += wm.activeEntities.length;
    }

    // Get stats from database
    const dbStats = await graphService.getMemoryStats(familyId);

    return {
      working: {
        count: workingMemories.length,
        pendingFacts: pendingFactsCount,
        activeEntities: activeEntitiesCount,
      },
      episodic: dbStats.episodic,
      semantic: dbStats.semantic,
      procedural: dbStats.procedural,
      lastUpdated: new Date(),
    };
  }
}

export const memoryService = new MemoryService();
