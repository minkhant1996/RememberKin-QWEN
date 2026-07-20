/**
 * Usage & Cost Tracking Routes
 *
 * Endpoints for tracking token usage and cost estimates.
 */

import { Router, Request, Response } from 'express';
import { MODEL_PRICING, getModelPricing, calculateCost, getModelsByCategory } from '../config/pricing.js';
import { QWEN_MODELS, selectModel } from '../config/qwen.js';
import { budgetService } from '../services/budget.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/usage/budget
 * Deployment-wide AI spend against the hard budget cap
 */
router.get('/budget', async (req: Request, res: Response) => {
  res.json({ success: true, data: await budgetService.getStatus() });
});

/**
 * GET /api/v1/usage/models
 * List all available models with pricing
 */
router.get('/models', (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;

    let models = Object.values(MODEL_PRICING);

    if (category) {
      models = models.filter((m) => m.category === category);
    }

    res.json({
      success: true,
      data: {
        models,
        categories: ['chat', 'vision', 'embedding', 'reasoning', 'coding', 'translation'],
        totalModels: models.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get models');
    res.status(500).json({ success: false, error: 'Failed to get models' });
  }
});

/**
 * GET /api/v1/usage/models/:modelId
 * Get pricing for a specific model
 */
router.get('/models/:modelId', (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const pricing = getModelPricing(modelId);

    if (!pricing) {
      return res.status(404).json({
        success: false,
        error: `Model ${modelId} not found`,
      });
    }

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get model pricing');
    res.status(500).json({ success: false, error: 'Failed to get model pricing' });
  }
});

/**
 * POST /api/v1/usage/estimate
 * Estimate cost for a hypothetical request
 */
router.post('/estimate', (req: Request, res: Response) => {
  try {
    const { modelId, inputTokens, outputTokens, text } = req.body;

    // Calculate tokens from text if provided
    let input = inputTokens || 0;
    let output = outputTokens || 0;

    if (text && !inputTokens) {
      input = Math.ceil(text.length / 4); // Estimate ~4 chars per token
    }

    const pricing = getModelPricing(modelId);
    if (!pricing) {
      return res.status(400).json({
        success: false,
        error: `Model ${modelId} not found`,
      });
    }

    const cost = calculateCost(modelId, input, output);

    res.json({
      success: true,
      data: {
        model: pricing,
        tokenUsage: {
          input,
          output,
          total: input + output,
        },
        costEstimate: {
          ...cost,
          currency: 'USD',
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to estimate cost');
    res.status(500).json({ success: false, error: 'Failed to estimate cost' });
  }
});

/**
 * GET /api/v1/usage/current-config
 * Get the current model configuration used by agents
 */
router.get('/current-config', (req: Request, res: Response) => {
  try {
    const config = {
      chat: {
        task: 'chat',
        model: selectModel('chat'),
        pricing: getModelPricing(selectModel('chat')),
      },
      extraction: {
        task: 'extract',
        model: selectModel('extract'),
        pricing: getModelPricing(selectModel('extract')),
      },
      fast: {
        task: 'fast',
        model: selectModel('fast'),
        pricing: getModelPricing(selectModel('fast')),
      },
      embedding: {
        task: 'embed',
        model: selectModel('embed'),
        pricing: getModelPricing(selectModel('embed')),
      },
      reasoning: {
        task: 'reason',
        model: selectModel('reason'),
        pricing: getModelPricing(selectModel('reason')),
      },
      vision: {
        task: 'vision',
        model: selectModel('vision'),
        pricing: getModelPricing(selectModel('vision')),
      },
    };

    res.json({
      success: true,
      data: {
        config,
        rawModels: QWEN_MODELS,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get current config');
    res.status(500).json({ success: false, error: 'Failed to get current config' });
  }
});

/**
 * POST /api/v1/usage/compare
 * Compare costs across different models for the same request
 */
router.post('/compare', (req: Request, res: Response) => {
  try {
    const { inputTokens, outputTokens, models } = req.body;

    if (!inputTokens || !outputTokens) {
      return res.status(400).json({
        success: false,
        error: 'inputTokens and outputTokens are required',
      });
    }

    // Default to comparing all chat models
    const modelsToCompare: string[] = models || ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-flash', 'qwen3.5-flash'];

    const comparisons = modelsToCompare.map((modelId: string) => {
      const pricing = getModelPricing(modelId);
      const cost = calculateCost(modelId, inputTokens, outputTokens);

      return {
        model: modelId,
        name: pricing?.name || modelId,
        category: pricing?.category,
        tokenUsage: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        cost: {
          ...cost,
          currency: 'USD',
        },
        contextWindow: pricing?.contextWindow,
        maxOutput: pricing?.maxOutput,
      };
    });

    // Sort by total cost
    comparisons.sort((a, b) => a.cost.totalCost - b.cost.totalCost);

    res.json({
      success: true,
      data: {
        comparisons,
        cheapest: comparisons[0]?.model,
        mostExpensive: comparisons[comparisons.length - 1]?.model,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to compare costs');
    res.status(500).json({ success: false, error: 'Failed to compare costs' });
  }
});

/**
 * GET /api/v1/usage/free-quota
 * Get models with free quota remaining
 */
router.get('/free-quota', (req: Request, res: Response) => {
  try {
    const modelsWithFreeQuota = Object.values(MODEL_PRICING)
      .filter((m) => m.hasFreeQuota)
      .map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        freeQuotaTokens: m.freeQuotaTokens,
        inputPricePerMillion: m.inputPricePerMillion,
        outputPricePerMillion: m.outputPricePerMillion,
      }));

    res.json({
      success: true,
      data: {
        models: modelsWithFreeQuota,
        totalModelsWithFreeQuota: modelsWithFreeQuota.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get free quota models');
    res.status(500).json({ success: false, error: 'Failed to get free quota models' });
  }
});

export default router;
