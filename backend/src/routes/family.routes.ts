import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { sendInviteEmail } from '../services/email.service.js';
import { errors } from '../middleware/error.middleware.js';
import { signToken } from '../utils/jwt.js';
import { WebSocketHandler } from '../websocket/handler.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createFamilySchema = z.object({
  name: z.string().min(2),
});

const addMemberSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional(),
  birthDate: z.string().optional(),
  isDeceased: z.boolean().optional(),
  relationship: z.enum(['PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF']).optional(),
  relatedTo: z.string().uuid().optional(),
  email: z.string().email().optional(),
});

const claimInviteSchema = z.object({
  inviteToken: z.string().min(1),
  action: z.enum(['accept', 'decline']),
});

const resendInviteSchema = z.object({
  placeholderId: z.string().uuid(),
});

// GET /api/v1/family
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (!user.familyId) {
      res.json(null);
      return;
    }

    const family = await graphService.getFamily(user.familyId);
    res.json(family);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/family
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { name } = createFamilySchema.parse(req.body);

    const family = await graphService.createFamily(name, user.id);

    // Issue a new token with familyId so subsequent requests work immediately
    const token = signToken({ id: user.id, email: user.email, familyId: family.id });

    res.status(201).json({ ...family, token });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/family/tree
router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const tree = await graphService.getFamilyTree(user.familyId);
    res.json(tree);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/family/invite — add a member (registered or placeholder)
router.post('/invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { name, nickname, birthDate, isDeceased, relationship, relatedTo, email } =
      addMemberSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('You must be a member of a family to add members');
    }

    const relationshipData = relationship && relatedTo
      ? { type: relationship, relatedTo }
      : undefined;

    // If email provided, check if already a registered user
    if (email) {
      const existing = await graphService.getPersonByEmail(email);
      if (existing) {
        if (existing.familyId === user.familyId) {
          throw errors.badRequest('This person is already a member of your family');
        }
        // Registered user — use existing direct-add flow
        const success = await graphService.addMemberToFamily(
          user.familyId,
          existing.id,
          relationshipData
        );
        if (!success) throw errors.internal('Failed to add member to family');

        return res.json({
          message: 'Member added to family successfully',
          member: { id: existing.id, name: existing.name, email: existing.email, isRegistered: true },
          inviteSent: false,
        });
      }
    }

    // Create placeholder member
    const placeholder = await graphService.createPlaceholderMember({
      name,
      nickname,
      birthDate,
      isDeceased,
      familyId: user.familyId,
      inviteEmail: email,
      addedById: user.id,
    });

    // Add relationship if specified
    if (relationshipData) {
      await graphService.addFamilyRelationship(
        placeholder.id,
        relationshipData.relatedTo,
        relationshipData.type
      );
    }

    let inviteSent = false;

    // Create invite token if email provided
    if (email) {
      const inviterPerson = await graphService.getPerson(user.id);
      const family = await graphService.getFamily(user.familyId);

      const invite = await graphService.createFamilyInvite({
        email,
        familyId: user.familyId,
        placeholderId: placeholder.id,
        inviterId: user.id,
      });

      try {
        await sendInviteEmail(email, {
          inviterName: inviterPerson?.name ?? user.email,
          familyName: family?.name ?? 'your family',
          inviteToken: invite.token,
        });
        inviteSent = true;
      } catch (emailErr) {
        logger.warn({ err: emailErr }, 'Failed to send invite email');
      }
    }

    res.status(201).json({
      message: 'Family member added successfully',
      member: { ...placeholder, isRegistered: false },
      inviteSent,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/family/invite/claim — accept or decline a pending invite
router.post('/invite/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { inviteToken, action } = claimInviteSchema.parse(req.body);

    const invite = await graphService.getInviteByToken(inviteToken);
    if (!invite) {
      throw errors.notFound('Invite (may be expired or already used)');
    }

    if (action === 'accept') {
      await graphService.claimPlaceholder(invite.placeholderId, user.id);

      // Issue fresh token with familyId
      const token = signToken({ id: user.id, email: user.email, familyId: invite.familyId });

      // Notify inviter via WebSocket
      WebSocketHandler.instance?.sendToUser(invite.inviterId, {
        type: 'member:claimed',
        message: `${user.email} has joined the family!`,
        memberId: user.id,
      });

      return res.json({ message: 'Joined family successfully', token, familyId: invite.familyId });
    } else {
      const { addedById } = await graphService.declineFamilyInvite(invite.id, invite.placeholderId);

      // Notify inviter via WebSocket
      if (addedById) {
        WebSocketHandler.instance?.sendToUser(addedById, {
          type: 'member:declined',
          message: `${user.email} chose not to join the family at this time.`,
        });
      }

      return res.json({ message: 'Invite declined' });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/family/invite/resend — resend invite for a placeholder member
router.post('/invite/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { placeholderId } = resendInviteSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('You must be a member of a family');
    }

    const placeholder = await graphService.getPerson(placeholderId);
    if (!placeholder) throw errors.notFound('Member');

    const inviteEmail = (placeholder as any).inviteEmail as string | null;
    if (!inviteEmail) {
      throw errors.badRequest('This member has no email address to invite');
    }

    const inviterPerson = await graphService.getPerson(user.id);
    const family = await graphService.getFamily(user.familyId);

    const invite = await graphService.resendFamilyInvite({
      placeholderId,
      email: inviteEmail,
      inviterId: user.id,
      familyId: user.familyId,
    });

    try {
      await sendInviteEmail(inviteEmail, {
        inviterName: inviterPerson?.name ?? user.email,
        familyName: family?.name ?? 'your family',
        inviteToken: invite.token,
      });
    } catch (emailErr) {
      logger.warn({ err: emailErr }, 'Failed to resend invite email');
    }

    res.json({ message: 'Invite resent successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
