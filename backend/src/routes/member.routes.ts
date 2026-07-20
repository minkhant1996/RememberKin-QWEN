import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { errors } from '../middleware/error.middleware.js';

const router = Router();

// Schema for creating a new family member (non-user, e.g., deceased relatives)
const createMemberSchema = z.object({
  name: z.string().min(2),
  nickname: z.string().optional(),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  isDeceased: z.boolean().optional(),
  avatar: z.string().url().optional(),
  relationship: z.object({
    type: z.enum(['PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF']),
    relatedTo: z.string(),
  }).optional(),
});

const addRelationshipSchema = z.object({
  relatedTo: z.string().uuid(),
  type: z.enum(['PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF']),
});

const updateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  nickname: z.string().optional(),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  isDeceased: z.boolean().optional(),
  avatar: z.string().url().optional(),
  preferences: z.record(z.string()).optional(),
});

// GET /api/v1/members
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const members = await graphService.getFamilyMembers(user.familyId);
    res.json({ members });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/members - Create a new family member (non-user, e.g., deceased relatives)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const input = createMemberSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Create the family member (without email/password - they can't login)
    const member = await graphService.createFamilyMember({
      name: input.name,
      nickname: input.nickname,
      birthDate: input.birthDate,
      deathDate: input.deathDate,
      isDeceased: input.isDeceased ?? (input.deathDate ? true : false),
      avatar: input.avatar,
      familyId: user.familyId,
    });

    // If relationship specified, create it
    if (input.relationship) {
      await graphService.addFamilyRelationship(
        member.id,
        input.relationship.relatedTo,
        input.relationship.type
      );
    }

    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/members/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const member = await graphService.getPerson(id);
    if (!member) {
      throw errors.notFound('Member');
    }

    res.json(member);
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/members/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const input = updateMemberSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Verify the member belongs to the same family
    const members = await graphService.getFamilyMembers(user.familyId);
    const memberExists = members.some(m => m.id === id);

    if (!memberExists && id !== user.id) {
      throw errors.forbidden('You can only update members of your family');
    }

    const member = await graphService.updatePerson(id, input);
    if (!member) {
      throw errors.notFound('Member');
    }

    res.json(member);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/members/:id/relationships — connect two existing members
// Direction: the member in :id is the <type> of relatedTo (e.g. PARENT_OF child)
router.post('/:id/relationships', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { relatedTo, type } = addRelationshipSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Both members must belong to the caller's family
    const members = await graphService.getFamilyMembers(user.familyId);
    const ids = new Set(members.map((m) => m.id));
    if (!ids.has(id) || !ids.has(relatedTo)) {
      throw errors.notFound('Member not found in your family');
    }
    if (id === relatedTo) {
      throw errors.badRequest('Cannot relate a member to themselves');
    }

    await graphService.addFamilyRelationship(id, relatedTo, type);
    res.status(201).json({ from: id, to: relatedTo, type });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/members/:id/relationship
router.get('/:id/relationship', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const relationship = await graphService.getRelationshipPath(user.id, id);
    if (!relationship) {
      res.json({ path: [], relationships: [], message: 'No relationship path found' });
      return;
    }

    res.json(relationship);
  } catch (error) {
    next(error);
  }
});

export default router;
