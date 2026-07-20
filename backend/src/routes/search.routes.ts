import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { vectorService } from '../services/vector.service.js';
import { errors } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/v1/search
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const query = req.query.q as string;
    const typesParam = req.query.types as string | undefined;
    const limitParam = parseInt(req.query.limit as string) || 10;

    if (!query || query.length < 2) {
      throw errors.badRequest('Search query must be at least 2 characters');
    }

    const types: ('stories' | 'memories')[] = typesParam ? typesParam.split(',') as ('stories' | 'memories')[] : ['stories', 'memories'];
    const limit = Math.min(Math.max(limitParam, 1), 50);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Semantic search
    const searchResults = await vectorService.search(
      query,
      user.familyId,
      user.id,
      types,
      limit
    );

    // Fetch full content for results
    const results = await Promise.all(
      searchResults.map(async (result) => {
        if (result.type === 'story') {
          const story = await graphService.getStory(result.id, user.id);
          return story ? {
            type: 'story',
            id: story.id,
            content: story.content,
            summary: story.summary,
            relevance: result.relevance,
          } : null;
        } else {
          const memories = await graphService.getMemories(user.familyId!);
          const memory = memories.find(m => m.id === result.id);
          return memory ? {
            type: 'memory',
            id: memory.id,
            content: memory.fact,
            relevance: result.relevance,
          } : null;
        }
      })
    );

    res.json({
      results: results.filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
