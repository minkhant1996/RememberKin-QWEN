/**
 * Image Generation Service
 *
 * Provides AI-powered image generation using Qwen/Wan models.
 * Supports text-to-image, image editing, and multi-image generation.
 *
 * @module services/image.service
 *
 * @example
 * ```typescript
 * import { imageService } from './services/image.service';
 *
 * // Generate an image from text
 * const result = await imageService.generateImage({
 *   prompt: 'A happy family having dinner together',
 *   model: 'qwen-image-2.0',
 * });
 *
 * // Edit an existing image
 * const edited = await imageService.editImage({
 *   prompt: 'Add a birthday cake on the table',
 *   imageUrl: 'https://...',
 *   model: 'qwen-image-2.0',
 * });
 * ```
 */

import { config } from '../config/index.js';
import { calculateImageCost, getModelPricing, RECOMMENDED_MODELS } from '../config/pricing.js';
import { logger } from '../utils/logger.js';
import { ExternalApiError, logError } from '../utils/errors.js';
import { withRetry, RetryOptions } from '../utils/retry.js';
import { budgetService } from './budget.service.js';

// DashScope Image API endpoint (different from OpenAI-compatible endpoint)
// For international: https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis
const DASHSCOPE_IMAGE_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const DASHSCOPE_MULTIMODAL_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  negativePrompt?: string;
  n?: number;                    // Number of images to generate (1-4)
  size?: '1024x1024' | '1024x1536' | '1536x1024' | '512x512';
  watermark?: boolean;
}

/**
 * Image editing options
 */
export interface ImageEditOptions {
  prompt: string;
  imageUrl: string;              // URL of image to edit
  model?: string;
  negativePrompt?: string;
  n?: number;
}

/**
 * Multi-image editing options (combine multiple images)
 */
export interface MultiImageEditOptions {
  prompt: string;
  imageUrls: string[];           // Up to 4 images
  model?: string;
  negativePrompt?: string;
  n?: number;
}

/**
 * Generated image result
 */
export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
}

/**
 * Image generation response with cost tracking
 */
export interface ImageResponse {
  images: GeneratedImage[];
  model: string;
  cost: {
    costPerImage: number;
    totalCost: number;
    currency: 'USD';
  };
  latencyMs: number;
}

/**
 * Retry options for image generation
 */
const IMAGE_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2,
  initialDelay: 2000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  isRetryable: (error: Error) => {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    );
  },
};

/**
 * Image Service Class
 */
export class ImageService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.qwen.apiKey;
  }

  /**
   * Generate images from text prompt
   * Uses DashScope text2image API
   */
  async generateImage(options: ImageGenerationOptions): Promise<ImageResponse> {
    const model = options.model || RECOMMENDED_MODELS.image;
    const startTime = Date.now();

    // Determine which API endpoint to use based on model
    const isMultimodal = model.includes('qwen-image') || model.includes('wan2.7');
    const apiUrl = isMultimodal ? DASHSCOPE_MULTIMODAL_URL : DASHSCOPE_IMAGE_URL;

    const operation = async () => {
      await budgetService.assertWithinBudget();
      let requestBody: any;

      if (isMultimodal) {
        // Multimodal API format (qwen-image-2.0, wan2.7)
        requestBody = {
          model,
          input: {
            messages: [
              {
                role: 'user',
                content: [{ text: options.prompt }],
              },
            ],
          },
          parameters: {
            n: options.n || 1,
            size: (options.size || '1024x1024').replace('x', '*'),  // DashScope uses * format
            negative_prompt: options.negativePrompt || '',
          },
        };
      } else {
        // Text2Image API format (flux, wan2.1)
        requestBody = {
          model,
          input: {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt || '',
          },
          parameters: {
            n: options.n || 1,
            size: options.size || '1024*1024',
          },
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          // Note: Removed X-DashScope-Async as it's not supported for all API tiers
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.message || data.error?.message || `HTTP ${response.status}`);
      }

      // Handle async task - poll for completion
      if (data.output?.task_id) {
        return await this.pollTaskStatus(data.output.task_id);
      }

      // Debug log the response structure
      logger.debug({
        responseKeys: Object.keys(data as object),
        outputKeys: data.output ? Object.keys(data.output as object) : [],
        hasChoices: !!data.choices,
        outputType: typeof data.output,
      }, 'Image API response structure');

      return data;
    };

    try {
      const result = await withRetry(operation, {
        ...IMAGE_RETRY_OPTIONS,
        operationName: 'generateImage',
      });

      const data = result.data;
      const latencyMs = Date.now() - startTime;

      // Extract image URLs from response
      const images: GeneratedImage[] = this.extractImages(data);

      const imageCount = images.length || (options.n || 1);
      const cost = calculateImageCost(model, imageCount);
      budgetService.recordSpend(cost.totalCost);

      logger.info({
        operation: 'generateImage',
        model,
        imageCount,
        cost: cost.totalCost,
        latencyMs,
      }, 'Image generated successfully');

      return {
        images,
        model,
        cost: { ...cost, currency: 'USD' },
        latencyMs,
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Image generation failed', {
        cause: error as Error,
        context: {
          operation: 'generateImage',
          metadata: { model, promptLength: options.prompt.length },
        },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Poll async task status until completion
   */
  private async pollTaskStatus(taskId: string, maxAttempts = 60): Promise<any> {
    const pollUrl = `https://dashscope-intl.aliyuncs.com/api/v1/tasks/${taskId}`;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const response = await fetch(pollUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const data: any = await response.json();

      if (data.output?.task_status === 'SUCCEEDED') {
        return data;
      } else if (data.output?.task_status === 'FAILED') {
        throw new Error(data.output?.message || 'Task failed');
      }
      // Continue polling if PENDING or RUNNING
    }

    throw new Error('Task timed out');
  }

  /**
   * Extract images from various response formats
   */
  private extractImages(data: any): GeneratedImage[] {
    // Try different response formats

    // Format 1: output.choices (qwen-image-2.0 multimodal format)
    if (data.output?.choices) {
      const images: GeneratedImage[] = [];
      for (const choice of data.output.choices) {
        if (choice.message?.content) {
          for (const content of choice.message.content) {
            if (content.image) {
              images.push({ url: content.image });
            }
          }
        }
      }
      if (images.length > 0) return images;
    }

    // Format 2: output.results (wanx format)
    if (data.output?.results) {
      return data.output.results.map((r: any) => ({
        url: r.url || r.image_url || r.b64_image,
        revisedPrompt: r.revised_prompt,
      }));
    }

    // Format 3: output.result.url
    if (data.output?.result?.url) {
      return [{ url: data.output.result.url }];
    }

    // Format 4: output.images
    if (data.output?.images) {
      return data.output.images.map((img: any) => ({
        url: typeof img === 'string' ? img : img.url,
      }));
    }

    return [];
  }

  /**
   * Edit an existing image with a text prompt
   */
  async editImage(options: ImageEditOptions): Promise<ImageResponse> {
    const model = options.model || RECOMMENDED_MODELS.imageEdit;
    const startTime = Date.now();

    const operation = async () => {
      await budgetService.assertWithinBudget();
      const response = await fetch(DASHSCOPE_MULTIMODAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { image: options.imageUrl },
                  { text: options.prompt },
                ],
              },
            ],
          },
          parameters: {
            n: options.n || 1,
            negative_prompt: options.negativePrompt || '',
          },
        }),
      });

      if (!response.ok) {
        const error: any = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json() as Promise<any>;
    };

    try {
      const result = await withRetry(operation, {
        ...IMAGE_RETRY_OPTIONS,
        operationName: 'editImage',
      });

      const data = result.data;
      const latencyMs = Date.now() - startTime;

      // Handles both output.choices (qwen-image-2.0) and output.results formats
      const images: GeneratedImage[] = this.extractImages(data);

      const imageCount = images.length || (options.n || 1);
      const cost = calculateImageCost(model, imageCount);
      budgetService.recordSpend(cost.totalCost);

      logger.info({
        operation: 'editImage',
        model,
        imageCount,
        cost: cost.totalCost,
        latencyMs,
      }, 'Image edited successfully');

      return {
        images,
        model,
        cost: { ...cost, currency: 'USD' },
        latencyMs,
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Image editing failed', {
        cause: error as Error,
        context: {
          operation: 'editImage',
          metadata: { model },
        },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Combine/edit multiple images with a text prompt
   * Example: "Make the person from Image 1 wear the dress from Image 2"
   */
  async combineImages(options: MultiImageEditOptions): Promise<ImageResponse> {
    const model = options.model || RECOMMENDED_MODELS.imageEdit;
    const startTime = Date.now();

    if (options.imageUrls.length < 2 || options.imageUrls.length > 4) {
      throw new Error('combineImages requires 2-4 images');
    }

    const operation = async () => {
      await budgetService.assertWithinBudget();
      const content: any[] = options.imageUrls.map(url => ({ image: url }));
      content.push({ text: options.prompt });

      const response = await fetch(DASHSCOPE_MULTIMODAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [
              {
                role: 'user',
                content,
              },
            ],
          },
          parameters: {
            n: options.n || 1,
            negative_prompt: options.negativePrompt || '',
          },
        }),
      });

      if (!response.ok) {
        const error: any = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json() as Promise<any>;
    };

    try {
      const result = await withRetry(operation, {
        ...IMAGE_RETRY_OPTIONS,
        operationName: 'combineImages',
      });

      const data = result.data;
      const latencyMs = Date.now() - startTime;

      const images: GeneratedImage[] = (data.output?.results || []).map((r: any) => ({
        url: r.url || r.image_url,
        revisedPrompt: r.revised_prompt,
      }));

      const imageCount = images.length || (options.n || 1);
      const cost = calculateImageCost(model, imageCount);
      budgetService.recordSpend(cost.totalCost);

      logger.info({
        operation: 'combineImages',
        model,
        inputImages: options.imageUrls.length,
        outputImages: imageCount,
        cost: cost.totalCost,
        latencyMs,
      }, 'Images combined successfully');

      return {
        images,
        model,
        cost: { ...cost, currency: 'USD' },
        latencyMs,
      };
    } catch (error) {
      const apiError = new ExternalApiError('Qwen', 'Image combining failed', {
        cause: error as Error,
        context: {
          operation: 'combineImages',
          metadata: { model, imageCount: options.imageUrls.length },
        },
      });
      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Generate a series of related images (e.g., seasons of a cat)
   */
  async generateImageSeries(
    basePrompt: string,
    variations: string[],
    options: Partial<ImageGenerationOptions> = {}
  ): Promise<{ series: ImageResponse[]; totalCost: number }> {
    const series: ImageResponse[] = [];
    let totalCost = 0;

    for (const variation of variations) {
      const prompt = `${basePrompt} ${variation}`;
      const result = await this.generateImage({
        ...options,
        prompt,
        n: 1,
      });
      series.push(result);
      totalCost += result.cost.totalCost;
    }

    logger.info({
      operation: 'generateImageSeries',
      count: variations.length,
      totalCost,
    }, 'Image series generated');

    return { series, totalCost };
  }

  /**
   * Get available image models
   */
  getAvailableModels(): Array<{ id: string; name: string; pricePerImage: number }> {
    const imageModels = [
      'qwen-image-2.0',
      'wan2.1-t2i-turbo',
      'wan2.1-t2i-plus',
      'wan2.7-image-pro',
      'flux-schnell',
      'flux-dev',
    ];

    return imageModels.map(id => {
      const pricing = getModelPricing(id);
      return {
        id,
        name: pricing?.name || id,
        pricePerImage: pricing?.pricePerImage || 0,
      };
    });
  }
}

/**
 * Singleton instance
 */
export const imageService = new ImageService();

/**
 * Prompt Templates
 * Use {{variable}} syntax for dynamic values
 * If variable is not provided, it will be replaced with empty string
 */
export const PROMPT_TEMPLATES = {
  // Memory visualization styles
  styles: {
    photorealistic: '{{description}}. Photorealistic, cinematic lighting, warm atmosphere{{extra}}',
    illustrated: '{{description}}. Warm illustrated style, soft colors, friendly illustration{{extra}}',
    vintage: '{{description}}. Vintage photograph style, sepia tones, nostalgic atmosphere{{extra}}',
    candid: '{{description}}. Candid photography style, natural moment, authentic emotion{{extra}}',
  },

  // Seasonal variations
  seasons: {
    spring: '{{basePrompt}} in spring with blooming flowers{{extra}}',
    summer: '{{basePrompt}} in summer with bright sunshine{{extra}}',
    autumn: '{{basePrompt}} in autumn with golden fallen leaves{{extra}}',
    winter: '{{basePrompt}} in winter with snow{{extra}}',
  },

  // Family Templates
  family: {
    portrait: 'A warm family portrait of {{members}}{{location}}{{extra}}',
    celebration: '{{event}} celebration with {{members}}{{decorations}}{{extra}}',
    memory: '{{description}}. Heartwarming family moment{{style}}{{extra}}',
    reunion: 'Family reunion with {{count}} generations gathered together{{location}}{{extra}}',
    tradition: '{{description}}. Family tradition being passed down through generations{{extra}}',
    heritage: '{{description}}. Cultural heritage and family roots{{extra}}',
    milestone: '{{description}}. Family milestone moment, joy and togetherness{{extra}}',
    generations: '{{description}}. Multiple generations together, passing down wisdom{{extra}}',
  },
};

/**
 * Fill template with variables
 * Replaces {{variable}} with value or empty string if not provided
 */
export function fillTemplate(template: string, variables: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? value : '';
  }).replace(/\s+/g, ' ').trim();
}

/**
 * Provider functions for agent use
 * These can be called by other agents/services
 */
export const imageProviders = {
  /**
   * Generate image from text
   */
  async textToImage(prompt: string, options?: Partial<ImageGenerationOptions>): Promise<ImageResponse> {
    return imageService.generateImage({ prompt, ...options });
  },

  /**
   * Edit existing image
   */
  async editImage(imageUrl: string, prompt: string, options?: Partial<ImageEditOptions>): Promise<ImageResponse> {
    return imageService.editImage({ imageUrl, prompt, ...options });
  },

  /**
   * Combine multiple images
   */
  async combineImages(imageUrls: string[], prompt: string, options?: Partial<MultiImageEditOptions>): Promise<ImageResponse> {
    return imageService.combineImages({ imageUrls, prompt, ...options });
  },

  /**
   * Generate family memory visualization
   * Creates an image representing a family memory/story
   *
   * @param memoryDescription - Description of the memory
   * @param style - Visual style (photorealistic, illustrated, vintage)
   * @param templateVars - Additional template variables (e.g., { extra: ', sunny day' })
   */
  async generateMemoryImage(
    memoryDescription: string,
    style: 'photorealistic' | 'illustrated' | 'vintage' = 'photorealistic',
    templateVars: Record<string, string> = {}
  ): Promise<ImageResponse> {
    const template = PROMPT_TEMPLATES.styles[style];
    const prompt = fillTemplate(template, {
      description: memoryDescription,
      ...templateVars,
    });

    return imageService.generateImage({
      prompt,
      model: 'qwen-image-2.0',
      n: 1,
      size: '1024x1024',  // Will be converted to 1024*1024 format
    });
  },

  /**
   * Generate image from template
   *
   * @param templateCategory - Category (styles, seasons, family)
   * @param templateName - Template name within category
   * @param variables - Variables to fill in the template
   * @param options - Image generation options
   */
  async generateFromTemplate(
    templateCategory: keyof typeof PROMPT_TEMPLATES,
    templateName: string,
    variables: Record<string, string>,
    options?: Partial<ImageGenerationOptions>
  ): Promise<ImageResponse> {
    const category = PROMPT_TEMPLATES[templateCategory] as Record<string, string>;
    const template = category[templateName];

    if (!template) {
      throw new Error(`Template ${templateCategory}.${templateName} not found`);
    }

    const prompt = fillTemplate(template, variables);

    return imageService.generateImage({
      prompt,
      model: options?.model || 'qwen-image-2.0',
      n: options?.n || 1,
      size: options?.size || '1024x1024',
      ...options,
    });
  },

  /**
   * Generate seasonal family photos
   * Creates a series showing a scene across different seasons
   *
   * @param basePrompt - Base prompt describing the scene
   * @param templateVars - Additional template variables
   */
  async generateSeasonalSeries(
    basePrompt: string,
    templateVars: Record<string, string> = {}
  ): Promise<{ series: ImageResponse[]; totalCost: number }> {
    const seasonNames = ['spring', 'summer', 'autumn', 'winter'] as const;
    const series: ImageResponse[] = [];
    let totalCost = 0;

    for (const season of seasonNames) {
      const template = PROMPT_TEMPLATES.seasons[season];
      const prompt = fillTemplate(template, {
        basePrompt,
        ...templateVars,
      });

      const result = await imageService.generateImage({
        prompt,
        model: 'qwen-image-2.0',
        n: 1,
      });

      series.push(result);
      totalCost += result.cost.totalCost;
    }

    return { series, totalCost };
  },

  /**
   * Generate family portrait
   *
   * @param members - Description of family members (e.g., "grandparents and 3 grandchildren")
   * @param options - Additional options like location, extra details
   */
  async generateFamilyPortrait(
    members: string,
    options: { location?: string; extra?: string } & Partial<ImageGenerationOptions> = {}
  ): Promise<ImageResponse> {
    const prompt = fillTemplate(PROMPT_TEMPLATES.family.portrait, {
      members,
      location: options.location ? ` in ${options.location}` : '',
      extra: options.extra || '',
    });

    return imageService.generateImage({
      prompt,
      model: options.model || 'qwen-image-2.0',
      n: options.n || 1,
      size: options.size || '1024x1024',
    });
  },

  /**
   * Generate celebration image
   *
   * @param event - Event name (e.g., "Birthday", "Wedding anniversary")
   * @param members - Family members description
   * @param options - Additional options
   */
  async generateCelebration(
    event: string,
    members: string,
    options: { decorations?: string; extra?: string } & Partial<ImageGenerationOptions> = {}
  ): Promise<ImageResponse> {
    const prompt = fillTemplate(PROMPT_TEMPLATES.family.celebration, {
      event,
      members,
      decorations: options.decorations ? `, ${options.decorations}` : '',
      extra: options.extra || '',
    });

    return imageService.generateImage({
      prompt,
      model: options.model || 'qwen-image-2.0',
      n: options.n || 1,
      size: options.size || '1024x1024',
    });
  },

  /**
   * Get available prompt templates
   */
  getTemplates(): typeof PROMPT_TEMPLATES {
    return PROMPT_TEMPLATES;
  },

  /**
   * Get image generation pricing
   */
  getPricing(): Array<{ id: string; name: string; pricePerImage: number }> {
    return imageService.getAvailableModels();
  },
};

/**
 * Helper: Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
