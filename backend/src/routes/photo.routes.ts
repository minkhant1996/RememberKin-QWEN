/**
 * Photo Routes (Photo Room)
 *
 * Families upload real photos, browse them, and use them as source
 * images for AI transformation (/api/v1/images/edit).
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { graphService } from '../services/graph.service.js';
import { errors } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

const router = Router();

/** Uploads directory at the backend root (server is started from backend/). */
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(errors.badRequest('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const uploadSchema = z.object({
  caption: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
  // Multipart sends this as a JSON-array string or comma-separated ids
  taggedMembers: z.string().optional(),
});

function parseTagged(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // fall through to comma-separated
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function toPhotoResponse(photo: any) {
  return {
    id: photo.id,
    url: `/uploads/${photo.filename}`,
    caption: photo.caption ?? null,
    note: photo.note ?? null,
    taggedMembers: photo.taggedMembers ?? [],
    uploadedBy: photo.uploadedBy,
    createdAt: photo.createdAt,
  };
}

/** Run multer and surface its errors (e.g. file too large) as 400s. */
function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  upload.single('photo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(errors.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5MB or smaller' : err.message));
    } else {
      next(err);
    }
  });
}

// POST /api/v1/photos
router.post('/', uploadPhoto, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    if (!req.file) {
      throw errors.badRequest('No photo file provided (use multipart field "photo")');
    }

    const { caption, note, taggedMembers } = uploadSchema.parse(req.body ?? {});

    const photo = await graphService.createPhoto({
      familyId: user.familyId,
      uploadedBy: user.id,
      filename: req.file.filename,
      caption,
      note,
      taggedMemberIds: parseTagged(taggedMembers),
    });

    logger.info({ photoId: photo.id, familyId: user.familyId }, 'Photo uploaded');

    res.status(201).json({ photo: toPhotoResponse(photo) });
  } catch (error) {
    // Don't leave orphaned files if metadata storage fails
    if (req.file) {
      fs.promises.unlink(path.join(UPLOADS_DIR, req.file.filename)).catch(() => {});
    }
    next(error);
  }
});

// GET /api/v1/photos
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const photos = await graphService.getPhotos(user.familyId);

    res.json({ photos: photos.map(toPhotoResponse) });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/photos/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const filename = await graphService.deletePhoto(id, user.id);

    if (!filename) {
      throw errors.forbidden('You can only delete your own photos');
    }

    // path.basename guards against any stored path segments
    await fs.promises.unlink(path.join(UPLOADS_DIR, path.basename(filename))).catch(() => {});

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
