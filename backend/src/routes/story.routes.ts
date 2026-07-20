import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { agentWrapper, UsageTracker } from '../services/agent-wrapper.js';
import { vectorService } from '../services/vector.service.js';
import { errors } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createStorySchema = z.object({
  content: z.string().min(10),
  authorId: z.string().uuid(),
  visibility: z.object({
    type: z.enum(['public', 'specific']),
    allowedUsers: z.array(z.string()).optional(),
  }).optional(),
});

// GET /api/v1/stories
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const [stories, total] = await Promise.all([
      graphService.getStories(user.familyId, user.id, limit, offset),
      graphService.countStories(user.familyId, user.id),
    ]);

    res.json({
      stories,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/stories
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const input = createStorySchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Track usage across all AI operations
    const usageTracker = new UsageTracker();

    // Use AI to summarize and extract metadata
    const summarizeResult = await agentWrapper.summarizeStory(input.content);
    usageTracker.track(summarizeResult);
    const { summary, mood, topics } = summarizeResult.output;

    // Create story in graph database
    const story = await graphService.createStory(input, summary, mood, topics);

    // Index for semantic search
    await vectorService.indexStory({
      id: story.id,
      content: input.content,
      authorId: input.authorId,
      familyId: user.familyId,
      topics,
      visibleTo: input.visibility?.allowedUsers,
    });

    // Extract entities and create memories
    const extractionResult = await agentWrapper.extractEntities(input.content);
    usageTracker.track(extractionResult);
    const entities = extractionResult.output;

    const familyMembers = await graphService.getFamilyMembers(user.familyId);

    // Match extracted people to family members
    const matchResult = await agentWrapper.matchPeopleToFamily(
      entities.people,
      familyMembers.map(m => ({ id: m.id, name: m.name, nickname: m.nickname }))
    );
    usageTracker.track(matchResult);
    const matches = matchResult.output;

    // Get matched person IDs for mentions
    const mentionedPersonIds = matches
      .filter((m) => m.matchedId)
      .map((m) => m.matchedId as string);

    // Add mentions to story
    if (mentionedPersonIds.length > 0) {
      await graphService.addStoryMentions(story.id, mentionedPersonIds);
    }

    // Create memories for extracted facts
    for (const fact of entities.facts) {
      const match = matches.find(m =>
        m.extractedName.toLowerCase() === fact.about.toLowerCase() && m.matchedId
      );

      if (match?.matchedId) {
        await graphService.createMemory(
          fact.fact,
          match.matchedId,
          fact.confidence,
          story.id
        );
      }
    }

    // Get updated story with mentions
    const updatedStory = await graphService.getStory(story.id, user.id);

    // Log usage summary
    const usageSummary = usageTracker.getSummary();
    logger.info({
      operation: 'createStory',
      storyId: story.id,
      usage: usageSummary,
    }, 'Story created with AI processing');

    res.status(201).json({
      ...(updatedStory || story),
      usage: usageSummary,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/stories/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const story = await graphService.getStory(id, user.id);
    if (!story) {
      throw errors.notFound('Story');
    }

    res.json(story);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/stories/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Delete from graph database (with permission check - only author can delete)
    const deleted = await graphService.deleteStory(id, user.id);

    if (!deleted) {
      throw errors.forbidden('You can only delete your own stories');
    }

    // Delete from vector store
    await vectorService.deleteStory(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

// POST /api/v1/stories/:id/react
router.post('/:id/react', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { emoji } = reactionSchema.parse(req.body);

    await graphService.addReaction(id, user.id, emoji);

    res.json({ success: true, emoji });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/stories/:id/react
router.delete('/:id/react', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    await graphService.removeReaction(id, user.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/stories/:id/reactions
router.get('/:id/reactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const reactions = await graphService.getReactions(id);

    res.json({ reactions });
  } catch (error) {
    next(error);
  }
});

export default router;
