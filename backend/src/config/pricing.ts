/**
 * Qwen Model Pricing Configuration
 *
 * Prices in USD per million tokens
 * Updated: 2026-06
 */

export interface ModelPricing {
  id: string;
  name: string;
  inputPricePerMillion: number;   // USD per 1M input tokens
  outputPricePerMillion: number;  // USD per 1M output tokens
  contextWindow: number;          // Max context tokens
  maxOutput: number;              // Max output tokens
  category: 'chat' | 'vision' | 'embedding' | 'reasoning' | 'coding' | 'tts' | 'asr' | 'image' | 'video' | 'translation';
  hasFreeQuota: boolean;
  freeQuotaTokens?: number;       // Free tokens available
  pricePerImage?: number;         // For image generation models (USD per image)
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ============ FLAGSHIP MODELS ============
  'qwen-max': {
    id: 'qwen-max',
    name: 'Qwen Max',
    inputPricePerMillion: 1.6,
    outputPricePerMillion: 6.4,
    contextWindow: 32800,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-plus': {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    inputPricePerMillion: 0.8,  // avg of 0.4-1.2
    outputPricePerMillion: 2.4, // avg of 1.2-3.6
    contextWindow: 1000000,
    maxOutput: 32800,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-plus-latest': {
    id: 'qwen-plus-latest',
    name: 'Qwen Plus Latest',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 2.4,
    contextWindow: 1000000,
    maxOutput: 32800,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-turbo': {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.2,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-turbo-latest': {
    id: 'qwen-turbo-latest',
    name: 'Qwen Turbo Latest',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.2,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-flash': {
    id: 'qwen-flash',
    name: 'Qwen Flash',
    inputPricePerMillion: 0.15,  // avg of 0.05-0.25
    outputPricePerMillion: 1.2,  // avg of 0.4-2
    contextWindow: 1000000,
    maxOutput: 32800,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ QWEN 3.5 SERIES ============
  'qwen3.5-flash': {
    id: 'qwen3.5-flash',
    name: 'Qwen 3.5 Flash',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3.5-plus': {
    id: 'qwen3.5-plus',
    name: 'Qwen 3.5 Plus',
    inputPricePerMillion: 0.45,  // avg
    outputPricePerMillion: 2.7,  // avg
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ QWEN 3.6 SERIES ============
  'qwen3.6-flash': {
    id: 'qwen3.6-flash',
    name: 'Qwen 3.6 Flash',
    inputPricePerMillion: 0.625,  // avg
    outputPricePerMillion: 2.75,  // avg
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3.6-plus': {
    id: 'qwen3.6-plus',
    name: 'Qwen 3.6 Plus',
    inputPricePerMillion: 1.25,  // avg
    outputPricePerMillion: 4.5,  // avg
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3.6-max-preview': {
    id: 'qwen3.6-max-preview',
    name: 'Qwen 3.6 Max Preview',
    inputPricePerMillion: 1.65,  // avg
    outputPricePerMillion: 9.9,  // avg
    contextWindow: 262100,
    maxOutput: 65500,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ QWEN 3.7 SERIES ============
  'qwen3.7-plus': {
    id: 'qwen3.7-plus',
    name: 'Qwen 3.7 Plus',
    inputPricePerMillion: 0.64,  // avg
    outputPricePerMillion: 2.56, // avg
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3.7-max': {
    id: 'qwen3.7-max',
    name: 'Qwen 3.7 Max',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 3.75,
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ REASONING MODELS ============
  'qwq-plus': {
    id: 'qwq-plus',
    name: 'QwQ Plus (Reasoning)',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 2.4,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'reasoning',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qvq-max': {
    id: 'qvq-max',
    name: 'QVQ Max (Visual Reasoning)',
    inputPricePerMillion: 1.2,
    outputPricePerMillion: 4.8,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'reasoning',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ QWEN 3 MAX ============
  'qwen3-max': {
    id: 'qwen3-max',
    name: 'Qwen 3 Max',
    inputPricePerMillion: 2.1,  // avg
    outputPricePerMillion: 10.5, // avg
    contextWindow: 262100,
    maxOutput: 65500,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ CODING MODELS ============
  'qwen3-coder-plus': {
    id: 'qwen3-coder-plus',
    name: 'Qwen 3 Coder Plus',
    inputPricePerMillion: 3.5,   // avg
    outputPricePerMillion: 32.5, // avg
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'coding',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3-coder-flash': {
    id: 'qwen3-coder-flash',
    name: 'Qwen 3 Coder Flash',
    inputPricePerMillion: 0.95,  // avg
    outputPricePerMillion: 5.55, // avg
    contextWindow: 1000000,
    maxOutput: 65500,
    category: 'coding',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3-coder-next': {
    id: 'qwen3-coder-next',
    name: 'Qwen 3 Coder Next',
    inputPricePerMillion: 0.55,  // avg
    outputPricePerMillion: 2.75, // avg
    contextWindow: 262100,
    maxOutput: 65500,
    category: 'coding',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ VISION MODELS ============
  'qwen-vl-max': {
    id: 'qwen-vl-max',
    name: 'Qwen VL Max',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 3.2,
    contextWindow: 131100,
    maxOutput: 32800,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-vl-plus': {
    id: 'qwen-vl-plus',
    name: 'Qwen VL Plus',
    inputPricePerMillion: 0.21,
    outputPricePerMillion: 0.63,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3-vl-plus': {
    id: 'qwen3-vl-plus',
    name: 'Qwen 3 VL Plus',
    inputPricePerMillion: 0.4,  // avg
    outputPricePerMillion: 3.2, // avg
    contextWindow: 262100,
    maxOutput: 32800,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3-vl-flash': {
    id: 'qwen3-vl-flash',
    name: 'Qwen 3 VL Flash',
    inputPricePerMillion: 0.085, // avg
    outputPricePerMillion: 0.68, // avg
    contextWindow: 262100,
    maxOutput: 32800,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ EMBEDDING MODELS ============
  'text-embedding-v3': {
    id: 'text-embedding-v3',
    name: 'Text Embedding V3',
    inputPricePerMillion: 0.07,
    outputPricePerMillion: 0,  // No output for embeddings
    contextWindow: 8192,
    maxOutput: 0,
    category: 'embedding',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'text-embedding-v4': {
    id: 'text-embedding-v4',
    name: 'Text Embedding V4',
    inputPricePerMillion: 0.07,
    outputPricePerMillion: 0,
    contextWindow: 8192,
    maxOutput: 0,
    category: 'embedding',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ OPEN SOURCE MODELS ============
  'qwen2.5-7b-instruct': {
    id: 'qwen2.5-7b-instruct',
    name: 'Qwen 2.5 7B Instruct',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.2,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen2.5-14b-instruct': {
    id: 'qwen2.5-14b-instruct',
    name: 'Qwen 2.5 14B Instruct',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen2.5-72b-instruct': {
    id: 'qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct',
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 1.6,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3-8b': {
    id: 'qwen3-8b',
    name: 'Qwen 3 8B',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.2,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3-32b': {
    id: 'qwen3-32b',
    name: 'Qwen 3 32B',
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.8,
    contextWindow: 131100,
    maxOutput: 8200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ TRANSLATION MODELS ============
  'qwen-mt-turbo': {
    id: 'qwen-mt-turbo',
    name: 'Qwen MT Turbo',
    inputPricePerMillion: 0.16,
    outputPricePerMillion: 0.49,
    contextWindow: 4100,
    maxOutput: 2000,
    category: 'translation',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-mt-plus': {
    id: 'qwen-mt-plus',
    name: 'Qwen MT Plus',
    inputPricePerMillion: 2.46,
    outputPricePerMillion: 7.37,
    contextWindow: 4100,
    maxOutput: 2000,
    category: 'translation',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen-mt-flash': {
    id: 'qwen-mt-flash',
    name: 'Qwen MT Flash',
    inputPricePerMillion: 0.16,
    outputPricePerMillion: 0.49,
    contextWindow: 16400,
    maxOutput: 8200,
    category: 'translation',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ DEEPSEEK ============
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.4,
    contextWindow: 1000000,
    maxOutput: 393200,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ GLM ============
  'glm-5.1': {
    id: 'glm-5.1',
    name: 'GLM 5.1',
    inputPricePerMillion: 1.4,
    outputPricePerMillion: 4.4,
    contextWindow: 202700,
    maxOutput: 131100,
    category: 'chat',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ OMNI MODELS ============
  'qwen3-omni-flash': {
    id: 'qwen3-omni-flash',
    name: 'Qwen 3 Omni Flash',
    inputPricePerMillion: 0.43,
    outputPricePerMillion: 1.66,
    contextWindow: 65500,
    maxOutput: 8000,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3.5-omni-flash': {
    id: 'qwen3.5-omni-flash',
    name: 'Qwen 3.5 Omni Flash',
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 2.2,
    contextWindow: 262100,
    maxOutput: 65500,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },
  'qwen3.5-omni-plus': {
    id: 'qwen3.5-omni-plus',
    name: 'Qwen 3.5 Omni Plus',
    inputPricePerMillion: 1.4,
    outputPricePerMillion: 8.3,
    contextWindow: 262100,
    maxOutput: 65500,
    category: 'vision',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ RERANK ============
  'qwen3-rerank': {
    id: 'qwen3-rerank',
    name: 'Qwen 3 Rerank',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0,
    contextWindow: 32800,
    maxOutput: 0,
    category: 'embedding',
    hasFreeQuota: true,
    freeQuotaTokens: 1000000,
  },

  // ============ IMAGE GENERATION ============
  'qwen-image-2.0': {
    id: 'qwen-image-2.0',
    name: 'Qwen Image 2.0',
    inputPricePerMillion: 0,      // Priced per image
    outputPricePerMillion: 0,
    contextWindow: 1000,          // 1000 token prompt support
    maxOutput: 0,
    category: 'image',
    hasFreeQuota: false,
    pricePerImage: 0.035,         // $0.035 per image
  },
  'wan2.1-t2i-turbo': {
    id: 'wan2.1-t2i-turbo',
    name: 'Wan 2.1 Text-to-Image Turbo',
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    contextWindow: 500,
    maxOutput: 0,
    category: 'image',
    hasFreeQuota: true,
    freeQuotaTokens: 500,         // 500 free images
    pricePerImage: 0.01,
  },
  'wan2.1-t2i-plus': {
    id: 'wan2.1-t2i-plus',
    name: 'Wan 2.1 Text-to-Image Plus',
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    contextWindow: 500,
    maxOutput: 0,
    category: 'image',
    hasFreeQuota: true,
    freeQuotaTokens: 500,
    pricePerImage: 0.02,
  },
  'wan2.7-image-pro': {
    id: 'wan2.7-image-pro',
    name: 'Wan 2.7 Image Pro',
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    contextWindow: 1000,
    maxOutput: 0,
    category: 'image',
    hasFreeQuota: true,
    freeQuotaTokens: 100,         // 100 free images
    pricePerImage: 0.05,
  },
  'flux-schnell': {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    contextWindow: 500,
    maxOutput: 0,
    category: 'image',
    hasFreeQuota: true,
    freeQuotaTokens: 500,
    pricePerImage: 0.006,
  },
  'flux-dev': {
    id: 'flux-dev',
    name: 'Flux Dev',
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    contextWindow: 500,
    maxOutput: 0,
    category: 'image',
    hasFreeQuota: true,
    freeQuotaTokens: 500,
    pricePerImage: 0.03,
  },
};

/**
 * Get pricing for a model
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  return MODEL_PRICING[modelId] || null;
}

/**
 * Calculate cost for a request
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = getModelPricing(modelId);

  if (!pricing) {
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,  // Round to 6 decimals
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
  };
}

/**
 * Calculate cost for image generation
 */
export function calculateImageCost(
  modelId: string,
  imageCount: number
): { costPerImage: number; totalCost: number } {
  const pricing = getModelPricing(modelId);

  if (!pricing || !pricing.pricePerImage) {
    return { costPerImage: 0, totalCost: 0 };
  }

  return {
    costPerImage: pricing.pricePerImage,
    totalCost: Math.round(pricing.pricePerImage * imageCount * 1_000_000) / 1_000_000,
  };
}

/**
 * Get all models by category
 */
export function getModelsByCategory(category: ModelPricing['category']): ModelPricing[] {
  return Object.values(MODEL_PRICING).filter(m => m.category === category);
}

/**
 * Get recommended models for tasks
 */
export const RECOMMENDED_MODELS = {
  // Best for complex reasoning and chat
  chat: 'qwen-max',
  chatFast: 'qwen-flash',
  chatCheap: 'qwen-turbo',

  // Best for reasoning/extraction
  reasoning: 'qwq-plus',
  extraction: 'qwq-plus',

  // Best for fast tasks
  fast: 'qwen-flash',
  ultraFast: 'qwen-turbo',

  // Best for embeddings
  embedding: 'text-embedding-v3',

  // Best for vision
  vision: 'qwen3-vl-plus',
  visionFast: 'qwen3-vl-flash',

  // Best for coding
  coding: 'qwen3-coder-plus',
  codingFast: 'qwen3-coder-flash',

  // Best for image generation
  image: 'qwen-image-2.0',           // Best quality
  imageFast: 'flux-schnell',         // Fastest & cheapest
  imageEdit: 'qwen-image-2.0',       // Supports editing

  // Best cost/performance ratio
  balanced: 'qwen3.5-flash',
};
