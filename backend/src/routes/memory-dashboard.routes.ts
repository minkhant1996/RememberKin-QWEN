/**
 * Memory Dashboard Routes
 *
 * API endpoints for the multi-layer memory system dashboard.
 *
 * @module routes/memory-dashboard.routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { memoryService } from '../services/memory.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/memory-dashboard/stats
 * Get memory statistics for all layers.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const stats = await memoryService.getMemoryStats(familyId);

    res.json(stats);
  } catch (error) {
    logger.error({
      operation: 'getMemoryStats',
      error: (error as Error).message,
    }, 'Failed to get memory stats');

    res.status(500).json({ error: 'Failed to get memory statistics' });
  }
});

/**
 * GET /api/v1/memory-dashboard/working
 * Get current working memory state.
 */
router.get('/working', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const workingMemories = memoryService.getAllWorkingMemories(familyId);

    // Aggregate all pending facts and active entities
    const aggregated = {
      sessions: workingMemories.length,
      pendingFacts: workingMemories.flatMap(wm => wm.pendingFacts),
      activeEntities: workingMemories.flatMap(wm => wm.activeEntities),
      currentTopics: [...new Set(workingMemories.flatMap(wm => wm.currentTopics))],
      lastUpdated: workingMemories.length > 0
        ? workingMemories.reduce((latest, wm) =>
            wm.updatedAt > latest ? wm.updatedAt : latest,
            workingMemories[0].updatedAt
          )
        : null,
    };

    res.json(aggregated);
  } catch (error) {
    logger.error({
      operation: 'getWorkingMemory',
      error: (error as Error).message,
    }, 'Failed to get working memory');

    res.status(500).json({ error: 'Failed to get working memory' });
  }
});

// Query options schema for episodic memories
const episodicQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  unconsolidatedOnly: z.string().transform(v => v === 'true').optional(),
  minImportance: z.string().transform(Number).optional(),
  eventType: z.enum(['conversation', 'story_added', 'event_created', 'memory_recalled']).optional(),
  sortBy: z.enum(['createdAt', 'importance', 'accessCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/v1/memory-dashboard/episodic
 * Get episodic memories with optional filtering.
 */
router.get('/episodic', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const options = episodicQuerySchema.parse(req.query);
    const memories = await memoryService.getEpisodicMemories(familyId, options);

    res.json({
      memories,
      total: memories.length,
      hasMore: memories.length === (options.limit || 20),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }

    logger.error({
      operation: 'getEpisodicMemories',
      error: (error as Error).message,
    }, 'Failed to get episodic memories');

    res.status(500).json({ error: 'Failed to get episodic memories' });
  }
});

// Query options schema for semantic memories
const semanticQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  aboutId: z.string().optional(),
  factType: z.enum(['preference', 'trait', 'biographical', 'relationship', 'routine', 'opinion']).optional(),
  minConfidence: z.string().transform(Number).optional(),
  sortBy: z.enum(['confidence', 'reinforcementCount', 'createdAt', 'decayFactor']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/v1/memory-dashboard/semantic
 * Get semantic memories with optional filtering.
 */
router.get('/semantic', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const options = semanticQuerySchema.parse(req.query);
    const memories = await memoryService.getSemanticMemories(familyId, options);

    // Group by person for display
    const byPerson = new Map<string, typeof memories>();
    for (const mem of memories) {
      const key = mem.aboutId;
      if (!byPerson.has(key)) {
        byPerson.set(key, []);
      }
      byPerson.get(key)!.push(mem);
    }

    res.json({
      memories,
      byPerson: Object.fromEntries(byPerson),
      total: memories.length,
      hasMore: memories.length === (options.limit || 50),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }

    logger.error({
      operation: 'getSemanticMemories',
      error: (error as Error).message,
    }, 'Failed to get semantic memories');

    res.status(500).json({ error: 'Failed to get semantic memories' });
  }
});

/**
 * GET /api/v1/memory-dashboard/procedural
 * Get procedural memories (patterns).
 */
router.get('/procedural', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const patterns = await memoryService.getProceduralMemories(familyId);

    res.json({
      patterns,
      total: patterns.length,
    });
  } catch (error) {
    logger.error({
      operation: 'getProceduralMemories',
      error: (error as Error).message,
    }, 'Failed to get procedural memories');

    res.status(500).json({ error: 'Failed to get procedural memories' });
  }
});

/**
 * GET /api/v1/memory-dashboard/activity
 * Get recent memory activity feed.
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const activities = await memoryService.getRecentActivity(familyId, limit);

    res.json({
      activities,
      total: activities.length,
    });
  } catch (error) {
    logger.error({
      operation: 'getMemoryActivity',
      error: (error as Error).message,
    }, 'Failed to get memory activity');

    res.status(500).json({ error: 'Failed to get memory activity' });
  }
});

/**
 * GET /api/v1/memory-dashboard/consolidation-queue
 * Get candidates for consolidation.
 */
router.get('/consolidation-queue', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const candidates = await memoryService.getConsolidationCandidates(familyId);

    res.json({
      candidates,
      total: candidates.length,
    });
  } catch (error) {
    logger.error({
      operation: 'getConsolidationCandidates',
      error: (error as Error).message,
    }, 'Failed to get consolidation candidates');

    res.status(500).json({ error: 'Failed to get consolidation candidates' });
  }
});

/**
 * POST /api/v1/memory-dashboard/consolidate
 * Manually trigger memory consolidation.
 */
router.post('/consolidate', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    logger.info({
      operation: 'consolidateMemories',
      familyId,
      userId: req.user!.id,
    }, 'Manual consolidation triggered');

    const result = await memoryService.consolidateMemories(familyId);

    res.json({
      success: true,
      result: {
        processed: result.processed,
        consolidated: result.consolidated,
        reinforced: result.reinforced,
        skipped: result.skipped,
        newMemoriesCount: result.newSemanticMemories.length,
        reinforcedMemoriesCount: result.reinforcedMemories.length,
      },
      activities: result.activities,
    });
  } catch (error) {
    logger.error({
      operation: 'consolidateMemories',
      error: (error as Error).message,
    }, 'Failed to consolidate memories');

    res.status(500).json({ error: 'Failed to consolidate memories' });
  }
});

/**
 * POST /api/v1/memory-dashboard/detect-patterns
 * Manually trigger pattern detection.
 */
router.post('/detect-patterns', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    logger.info({
      operation: 'detectPatterns',
      familyId,
      userId: req.user!.id,
    }, 'Manual pattern detection triggered');

    const result = await memoryService.detectPatterns(familyId);

    res.json({
      success: true,
      result: {
        patternsFound: result.patternsFound,
        newPatternsCount: result.newPatterns.length,
        reinforcedPatternsCount: result.reinforcedPatterns.length,
      },
      newPatterns: result.newPatterns,
    });
  } catch (error) {
    logger.error({
      operation: 'detectPatterns',
      error: (error as Error).message,
    }, 'Failed to detect patterns');

    res.status(500).json({ error: 'Failed to detect patterns' });
  }
});

/**
 * POST /api/v1/memory-dashboard/apply-decay
 * Manually trigger memory decay (for demo purposes).
 */
router.post('/apply-decay', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;
    const decayAmount = parseFloat(req.body.decayAmount) || 0.01;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const decayedCount = await memoryService.applyDecay(familyId, decayAmount);

    res.json({
      success: true,
      decayedCount,
      decayAmount,
    });
  } catch (error) {
    logger.error({
      operation: 'applyDecay',
      error: (error as Error).message,
    }, 'Failed to apply decay');

    res.status(500).json({ error: 'Failed to apply decay' });
  }
});

/**
 * POST /api/v1/memory-dashboard/maintenance
 * Run full memory maintenance (cleanup + decay + prune).
 * TIMELY FORGETTING: This endpoint demonstrates automatic memory cleanup.
 */
router.post('/maintenance', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    logger.info({
      operation: 'runMaintenance',
      familyId,
      userId: req.user!.id,
    }, 'Manual maintenance triggered');

    const result = await memoryService.runMaintenance(familyId);

    res.json({
      success: true,
      result: {
        workingMemory: {
          sessionsRemoved: result.workingCleanup.sessionsRemoved,
          factsRemoved: result.workingCleanup.factsRemoved,
        },
        agingDecay: result.agingDecay,
        pruned: {
          semanticPruned: result.pruned.semanticPruned,
          episodicPruned: result.pruned.episodicPruned,
        },
        episodicEnforced: result.episodicEnforced,
        summarized: result.summarized,
      },
      message: `Maintenance complete: ${result.pruned.semanticPruned + result.pruned.episodicPruned} memories pruned, ${result.agingDecay} decayed`,
    });
  } catch (error) {
    logger.error({
      operation: 'runMaintenance',
      error: (error as Error).message,
    }, 'Failed to run maintenance');

    res.status(500).json({ error: 'Failed to run maintenance' });
  }
});

/**
 * GET /api/v1/memory-dashboard/context
 * Get optimized context for chat.
 * CONTEXT WINDOW MANAGEMENT: Returns token-optimized memory context.
 */
router.get('/context', async (req: Request, res: Response) => {
  try {
    const familyId = req.user!.familyId;
    const query = (req.query.query as string) || '';
    const maxTokens = parseInt(req.query.maxTokens as string) || 4000;

    if (!familyId) {
      return res.status(400).json({ error: 'User must belong to a family' });
    }

    const context = await memoryService.getOptimizedContext(familyId, query, maxTokens);

    res.json({
      ...context,
      message: context.wasTruncated
        ? `Context truncated to ${context.tokenCount} tokens (${context.memoriesUsed} memories)`
        : `Full context: ${context.tokenCount} tokens (${context.memoriesUsed} memories)`,
    });
  } catch (error) {
    logger.error({
      operation: 'getOptimizedContext',
      error: (error as Error).message,
    }, 'Failed to get optimized context');

    res.status(500).json({ error: 'Failed to get optimized context' });
  }
});

export default router;
