import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { errors } from '../middleware/error.middleware.js';

const router = Router();

const createEventSchema = z.object({
  type: z.enum(['birthday', 'anniversary', 'surgery', 'custom']),
  title: z.string().min(2),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurring: z.boolean().optional(),
  reminderDays: z.array(z.number()).optional(),
  involves: z.array(z.string()),
  visibility: z.object({
    allowedUsers: z.array(z.string()).optional(),
  }).optional(),
});

const updateEventSchema = z.object({
  type: z.enum(['birthday', 'anniversary', 'surgery', 'custom']).optional(),
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recurring: z.boolean().optional(),
  reminderDays: z.array(z.number()).optional(),
  involves: z.array(z.string()).optional(),
});

// GET /api/v1/events
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const days = parseInt(req.query.days as string) || 30;
    const type = req.query.type as string | undefined;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    let events = await graphService.getUpcomingEvents(user.familyId, days);

    if (type) {
      events = events.filter(e => e.type === type);
    }

    // Add days until calculation
    const today = new Date();
    events = events.map(e => ({
      ...e,
      daysUntil: Math.ceil(
        (new Date(e.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/events
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const input = createEventSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const event = await graphService.createEvent(input, user.familyId);

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/events/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const input = updateEventSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const event = await graphService.updateEvent(id, input);

    if (!event) {
      throw errors.notFound('Event not found');
    }

    res.json(event);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/events/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const deleted = await graphService.deleteEvent(id);

    if (!deleted) {
      throw errors.notFound('Event not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
