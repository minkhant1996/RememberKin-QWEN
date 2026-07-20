import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config/index.js';
import { graphService } from '../services/graph.service.js';
import { errors } from '../middleware/error.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { signToken } from '../utils/jwt.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.allowRegistration) {
      throw errors.forbidden('Registration is disabled on this demo. Please sign in with one of the provided demo accounts.');
    }

    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user exists
    const existing = await graphService.getPersonByEmail(email);
    if (existing) {
      throw errors.conflict('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const person = await graphService.createPerson({ email, name, passwordHash });

    // New users have no family yet — omit familyId until they create/join one
    const token = signToken({ id: person.id, email: person.email! });

    // Check for pending family invites matching this email
    const pendingInvites = await graphService.getPendingInvitesByEmail(email);
    const pendingInvitesForClient = pendingInvites.map((inv) => ({
      inviteToken: inv.inviteToken,
      familyId: inv.familyId,
      familyName: inv.familyName,
      inviterName: inv.inviterName,
      placeholderId: inv.placeholderId,
    }));

    res.status(201).json({
      user: {
        id: person.id,
        email: person.email,
        name: person.name,
      },
      token,
      pendingInvites: pendingInvitesForClient,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const person = await graphService.getPersonByEmail(email);
    if (!person) {
      throw errors.unauthorized('Invalid email or password');
    }

    // Verify password
    const valid = await bcrypt.compare(password, person.passwordHash);
    if (!valid) {
      throw errors.unauthorized('Invalid email or password');
    }

    const token = signToken({ id: person.id, email: person.email!, familyId: person.familyId });

    res.json({
      user: {
        id: person.id,
        email: person.email,
        name: person.name,
        familyId: person.familyId,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me — re-reads Person from DB, issues fresh token with current familyId
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const person = await graphService.getPersonByEmail(req.user!.email);
    if (!person) {
      return next(errors.notFound('User'));
    }
    const token = signToken({ id: person.id, email: person.email!, familyId: person.familyId });
    res.json({
      user: { id: person.id, email: person.email, name: person.name, familyId: person.familyId },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Token invalidation would be handled by a blacklist in production
  res.json({ message: 'Logged out successfully' });
});

export default router;
