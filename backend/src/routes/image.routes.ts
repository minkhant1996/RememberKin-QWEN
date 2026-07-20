/**
 * Image Generation Routes
 *
 * API endpoints for AI-powered image generation.
 */

import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { imageService, imageProviders, PROMPT_TEMPLATES, fillTemplate } from '../services/image.service.js';
import { UPLOADS_DIR } from './photo.routes.js';
import { errors } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

const router = Router();

const UPLOAD_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * DashScope fetches imageUrl over the network, so local `/uploads/...` paths
 * are unreachable from its side. Inline them as base64 data URIs instead
 * (the multimodal-generation API accepts data URIs in the image field).
 */
async function resolveLocalImageUrl(imageUrl: string): Promise<string> {
  if (!imageUrl.startsWith('/uploads/')) return imageUrl;

  const filename = path.basename(imageUrl); // guards against traversal
  const filePath = path.join(UPLOADS_DIR, filename);

  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(filePath);
  } catch {
    throw errors.notFound('Uploaded photo');
  }

  const mimeType = UPLOAD_MIME_BY_EXT[path.extname(filename).toLowerCase()] || 'image/jpeg';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * POST /api/v1/images/generate
 * Generate image from text prompt
 */
const generateSchema = z.object({
  prompt: z.string().min(1).max(1000),
  model: z.string().optional(),
  negativePrompt: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', '512x512']).optional(),
  watermark: z.boolean().optional(),
});

router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = generateSchema.parse(req.body);

    const result = await imageService.generateImage(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/edit
 * Edit an existing image with a text prompt
 */
const editSchema = z.object({
  prompt: z.string().min(1).max(1000),
  // Either a public URL or a locally uploaded Photo Room path
  imageUrl: z.union([z.string().url(), z.string().regex(/^\/uploads\/[^/]+$/)]),
  model: z.string().optional(),
  negativePrompt: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
});

router.post('/edit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = editSchema.parse(req.body);
    input.imageUrl = await resolveLocalImageUrl(input.imageUrl);

    const result = await imageService.editImage(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/combine
 * Combine multiple images with a text prompt
 */
const combineSchema = z.object({
  prompt: z.string().min(1).max(1000),
  imageUrls: z.array(z.string().url()).min(2).max(4),
  model: z.string().optional(),
  negativePrompt: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
});

router.post('/combine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = combineSchema.parse(req.body);

    const result = await imageService.combineImages(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/memory
 * Generate an image for a family memory
 */
const memorySchema = z.object({
  description: z.string().min(1).max(500),
  style: z.enum(['photorealistic', 'illustrated', 'vintage']).optional(),
  templateVars: z.record(z.string()).optional(),  // Additional template variables
});

router.post('/memory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, style, templateVars } = memorySchema.parse(req.body);

    const result = await imageProviders.generateMemoryImage(description, style, templateVars || {});

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/template
 * Generate an image from a template
 */
const templateSchema = z.object({
  category: z.enum(['styles', 'seasons', 'family']),
  template: z.string().min(1),
  variables: z.record(z.string()),
  model: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', '512x512']).optional(),
});

router.post('/template', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, template, variables, ...options } = templateSchema.parse(req.body);

    const result = await imageProviders.generateFromTemplate(
      category,
      template,
      variables,
      options
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/portrait
 * Generate a family portrait
 */
const portraitSchema = z.object({
  members: z.string().min(1).max(200),
  location: z.string().optional(),
  extra: z.string().optional(),
  model: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', '512x512']).optional(),
});

router.post('/portrait', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = portraitSchema.parse(req.body);

    const result = await imageProviders.generateFamilyPortrait(input.members, {
      location: input.location,
      extra: input.extra,
      model: input.model,
      n: input.n,
      size: input.size,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/celebration
 * Generate a celebration image
 */
const celebrationSchema = z.object({
  event: z.string().min(1).max(100),
  members: z.string().min(1).max(200),
  decorations: z.string().optional(),
  extra: z.string().optional(),
  model: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', '512x512']).optional(),
});

router.post('/celebration', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = celebrationSchema.parse(req.body);

    const result = await imageProviders.generateCelebration(input.event, input.members, {
      decorations: input.decorations,
      extra: input.extra,
      model: input.model,
      n: input.n,
      size: input.size,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/seasonal
 * Generate a seasonal series of images
 */
const seasonalSchema = z.object({
  basePrompt: z.string().min(1).max(500),
});

router.post('/seasonal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { basePrompt } = seasonalSchema.parse(req.body);

    const result = await imageProviders.generateSeasonalSeries(basePrompt);

    res.json({
      success: true,
      data: {
        series: result.series,
        totalCost: result.totalCost,
        imageCount: result.series.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/images/models
 * Get available image generation models
 */
router.get('/models', (req: Request, res: Response) => {
  const models = imageProviders.getPricing();

  res.json({
    success: true,
    data: {
      models,
      recommended: {
        quality: 'qwen-image-2.0',
        fast: 'flux-schnell',
        balanced: 'wan2.1-t2i-plus',
      },
    },
  });
});

/**
 * GET /api/v1/images/templates
 * Get available prompt templates
 */
router.get('/templates', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      templates: PROMPT_TEMPLATES,
      usage: {
        syntax: 'Use {{variable}} in templates. Variables not provided will be empty string.',
        example: {
          template: '{{description}}. Photorealistic{{extra}}',
          variables: { description: 'A happy family', extra: ', sunny day' },
          result: 'A happy family. Photorealistic, sunny day',
        },
      },
    },
  });
});

/**
 * POST /api/v1/images/preview-template
 * Preview a filled template without generating an image
 */
const previewSchema = z.object({
  category: z.enum(['styles', 'seasons', 'family']),
  template: z.string().min(1),
  variables: z.record(z.string()),
});

router.post('/preview-template', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, template, variables } = previewSchema.parse(req.body);

    const categoryTemplates = PROMPT_TEMPLATES[category] as Record<string, string>;
    const templateStr = categoryTemplates[template];

    if (!templateStr) {
      throw errors.badRequest(`Template ${category}.${template} not found`);
    }

    const filledPrompt = fillTemplate(templateStr, variables);

    res.json({
      success: true,
      data: {
        template: templateStr,
        variables,
        filledPrompt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/estimate
 * Estimate cost for image generation
 */
const estimateSchema = z.object({
  model: z.string(),
  imageCount: z.number().min(1).max(10),
});

router.post('/estimate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { model, imageCount } = estimateSchema.parse(req.body);

    const models = imageProviders.getPricing();
    const modelInfo = models.find(m => m.id === model);

    if (!modelInfo) {
      throw errors.badRequest(`Model ${model} not found`);
    }

    res.json({
      success: true,
      data: {
        model: modelInfo.id,
        modelName: modelInfo.name,
        imageCount,
        costPerImage: modelInfo.pricePerImage,
        totalCost: modelInfo.pricePerImage * imageCount,
        currency: 'USD',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
