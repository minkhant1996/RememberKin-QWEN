import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { vectorService } from '../services/vector.service.js';
import { errors } from '../middleware/error.middleware.js';

const router = Router();

const createMemorySchema = z.object({
  fact: z.string().min(5),
  aboutId: z.string().uuid(),
});

// GET /api/v1/memories
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const aboutId = req.query.about as string | undefined;
    const minConfidence = parseFloat(req.query.minConfidence as string) || 0.7;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    let memories = await graphService.getMemories(user.familyId, aboutId);

    // Filter by confidence
    memories = memories.filter(m => m.confidence >= minConfidence);

    res.json({ memories });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/memories
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { fact, aboutId } = createMemorySchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Create memory with high confidence (manually added)
    const memory = await graphService.createMemory(fact, aboutId, 1.0);

    // Index for semantic search
    await vectorService.indexMemory({
      id: memory.id,
      fact,
      aboutId,
      familyId: user.familyId,
    });

    res.status(201).json(memory);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/memories/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Check permission - only allow deletion of memories about family members
    const memory = await graphService.getMemory(id);
    if (!memory) {
      throw errors.notFound('Memory');
    }

    if (memory.familyId !== user.familyId) {
      throw errors.forbidden('You can only delete memories from your own family');
    }

    // Delete from graph database
    const deleted = await graphService.deleteMemory(id);
    if (!deleted) {
      throw errors.notFound('Memory');
    }

    // Delete from vector store
    await vectorService.deleteMemory(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
