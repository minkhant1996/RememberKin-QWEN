/**
 * Usage & Pricing Service
 *
 * Provides functions to fetch model pricing and usage information.
 */

import api from './api';
import type { ModelPricing, ModelConfig } from '../types';

export interface ModelsResponse {
  models: ModelPricing[];
  categories: string[];
  totalModels: number;
}

export interface CurrentConfigResponse {
  config: Record<string, ModelConfig>;
  rawModels: Record<string, string>;
}

export interface CostEstimateResponse {
  model: ModelPricing;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  costEstimate: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: 'USD';
  };
}

export interface CostComparisonEntry {
  model: string;
  name: string;
  category: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: 'USD';
  };
  contextWindow: number;
  maxOutput: number;
}

export interface CostComparisonResponse {
  comparisons: CostComparisonEntry[];
  cheapest: string;
  mostExpensive: string;
}

export interface FreeQuotaModel {
  id: string;
  name: string;
  category: string;
  freeQuotaTokens: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export interface FreeQuotaResponse {
  models: FreeQuotaModel[];
  totalModelsWithFreeQuota: number;
}

export const usageService = {
  /**
   * Get all available models with pricing
   */
  async getModels(category?: string): Promise<ModelsResponse> {
    const params = category ? { category } : {};
    const response = await api.get<{ success: boolean; data: ModelsResponse }>(
      '/usage/models',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get pricing for a specific model
   */
  async getModelPricing(modelId: string): Promise<ModelPricing> {
    const response = await api.get<{ success: boolean; data: ModelPricing }>(
      `/usage/models/${modelId}`
    );
    return response.data.data;
  },

  /**
   * Get current model configuration used by agents
   */
  async getCurrentConfig(): Promise<CurrentConfigResponse> {
    const response = await api.get<{ success: boolean; data: CurrentConfigResponse }>(
      '/usage/current-config'
    );
    return response.data.data;
  },

  /**
   * Estimate cost for a hypothetical request
   */
  async estimateCost(
    modelId: string,
    options: { inputTokens?: number; outputTokens?: number; text?: string }
  ): Promise<CostEstimateResponse> {
    const response = await api.post<{ success: boolean; data: CostEstimateResponse }>(
      '/usage/estimate',
      { modelId, ...options }
    );
    return response.data.data;
  },

  /**
   * Compare costs across different models
   */
  async compareCosts(
    inputTokens: number,
    outputTokens: number,
    models?: string[]
  ): Promise<CostComparisonResponse> {
    const response = await api.post<{ success: boolean; data: CostComparisonResponse }>(
      '/usage/compare',
      { inputTokens, outputTokens, models }
    );
    return response.data.data;
  },

  /**
   * Get models with free quota
   */
  async getFreeQuotaModels(): Promise<FreeQuotaResponse> {
    const response = await api.get<{ success: boolean; data: FreeQuotaResponse }>(
      '/usage/free-quota'
    );
    return response.data.data;
  },
};

export default usageService;
