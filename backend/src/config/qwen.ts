import OpenAI from 'openai';
import { config } from './index.js';
import { calculateCost } from './pricing.js';
import { budgetService } from '../services/budget.service.js';

/**
 * Budget-guarded fetch: every Qwen API call (chat, extraction, embeddings)
 * passes through here. Calls are refused once the deployment's cumulative
 * spend hits MAX_TOTAL_COST_USD, and each response's token usage is metered.
 */
const budgetGuardedFetch = async (input: any, init?: any): Promise<any> => {
  await budgetService.assertWithinBudget();
  const response = await fetch(input, init);
  // Streaming (SSE) bodies must never be cloned/parsed here — cloning tees the
  // body and awaiting .json() would buffer the whole stream (or hang) before
  // the caller sees the first token. Streamed calls meter their own spend.
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (response.ok && !contentType.includes('text/event-stream')) {
    try {
      const data: any = await response.clone().json();
      const usage = data?.usage;
      if (usage) {
        let model: string = data.model || '';
        if (!model && typeof init?.body === 'string') {
          try { model = JSON.parse(init.body).model || ''; } catch { /* ignore */ }
        }
        const cost = calculateCost(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0);
        budgetService.recordSpend(cost.totalCost);
      }
    } catch {
      // Non-JSON/streaming body — skip accounting rather than break the call
    }
  }
  return response;
};

// Qwen Cloud uses OpenAI-compatible API
export const qwenClient = new OpenAI({
  apiKey: config.qwen.apiKey,
  baseURL: config.qwen.baseUrl,
  fetch: budgetGuardedFetch as any,
});

/**
 * Qwen Model Configuration
 *
 * BALANCED for cost + performance.
 * All models have 1M free tokens (expires 2026-06-29).
 *
 * Pricing (per 1M tokens):
 * - qwen-turbo:  $0.05 in / $0.20 out  ← CHEAPEST
 * - qwen-flash:  $0.15 in / $1.20 out  ← Fast (226ms)
 * - qwen-plus:   $0.80 in / $2.40 out  ← Good quality
 * - qwen-max:    $1.60 in / $6.40 out  ← Best (expensive)
 * - qwq-plus:    $0.80 in / $2.40 out  ← AVOID (150s latency!)
 */
export const QWEN_MODELS = {
  // ============ CHAT ============
  // Main conversations - need good quality
  CHAT: 'qwen-plus',                   // $0.80/$2.40 - good quality, reasonable price

  // ============ ENTITY EXTRACTION ============
  // Extract facts, people - needs to be fast
  EXTRACTION: 'qwen-turbo',            // $0.05/$0.20 - cheap & fast (NOT qwq-plus: 150s!)

  // ============ FAST TASKS ============
  // Summarization, simple parsing
  FAST: 'qwen-turbo',                  // $0.05/$0.20 - cheapest option

  // ============ EMBEDDINGS ============
  // Semantic search - only option
  EMBEDDING: 'text-embedding-v3',      // $0.07 - 1024 dimensions

  // ============ SPECIALIZED ============
  // Pattern detection
  REASONING: 'qwen-plus',              // $0.80/$2.40 - good for patterns (NOT qwq-plus!)

  // Memory consolidation
  CONSOLIDATION: 'qwen-turbo',         // $0.05/$0.20 - cheap for batch processing

  // Vision (future)
  VISION: 'qwen-vl-plus',              // $0.21/$0.63 - vision tasks

  // ============ IMAGE GENERATION ============
  IMAGE: 'qwen-image-2.0',           // Best quality ($0.035/image)
  IMAGE_FAST: 'flux-schnell',        // Fastest ($0.006/image)
  IMAGE_EDIT: 'qwen-image-2.0',      // Supports multi-image editing

  // ============ LEGACY ============
  QWEN_PLUS: 'qwen-plus',
  QWEN_TURBO: 'qwen-turbo',
  QWEN_MAX: 'qwen-max',
  QWEN_VL_PLUS: 'qwen-vl-plus',
  TEXT_EMBEDDING: 'text-embedding-v3',
};

/**
 * Model selection helper based on task type
 */
export function selectModel(task: 'chat' | 'extract' | 'fast' | 'embed' | 'reason' | 'vision' | 'image' | 'image_fast'): string {
  switch (task) {
    case 'chat':
      return QWEN_MODELS.CHAT;
    case 'extract':
      return QWEN_MODELS.EXTRACTION;
    case 'fast':
      return QWEN_MODELS.FAST;
    case 'embed':
      return QWEN_MODELS.EMBEDDING;
    case 'reason':
      return QWEN_MODELS.REASONING;
    case 'vision':
      return QWEN_MODELS.VISION;
    case 'image':
      return QWEN_MODELS.IMAGE;
    case 'image_fast':
      return QWEN_MODELS.IMAGE_FAST;
    default:
      return QWEN_MODELS.CHAT;
  }
}
