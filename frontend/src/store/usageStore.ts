/**
 * Usage Store
 *
 * Tracks cumulative API usage across the session.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UsageInfo, UsageSummary } from '../types';

interface UsageState {
  // Current session summary
  summary: UsageSummary;

  // Recent requests (keep last 50)
  recentRequests: Array<{
    id: string;
    timestamp: string;
    operation: string;
    usage: UsageInfo;
  }>;

  // Actions
  trackUsage: (operation: string, usage: UsageInfo) => void;
  resetSession: () => void;
  getSessionCost: () => number;
  getSessionTokens: () => number;
}

const initialSummary: UsageSummary = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  totalCost: 0,
  requests: 0,
  byModel: {},
};

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      summary: initialSummary,
      recentRequests: [],

      trackUsage: (operation: string, usage: UsageInfo) => {
        const model = usage.model || usage.models?.[0] || 'unknown';

        set((state) => {
          // Update summary
          const newSummary = { ...state.summary };
          newSummary.totalInputTokens += usage.tokenUsage.input;
          newSummary.totalOutputTokens += usage.tokenUsage.output;
          newSummary.totalTokens += usage.tokenUsage.total;
          newSummary.totalCost += usage.costEstimate.totalCost;
          newSummary.requests++;

          // Update by model
          if (!newSummary.byModel[model]) {
            newSummary.byModel[model] = { input: 0, output: 0, cost: 0, requests: 0 };
          }
          newSummary.byModel[model].input += usage.tokenUsage.input;
          newSummary.byModel[model].output += usage.tokenUsage.output;
          newSummary.byModel[model].cost += usage.costEstimate.totalCost;
          newSummary.byModel[model].requests++;

          // Add to recent requests (keep last 50)
          const newRequest = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            operation,
            usage,
          };
          const recentRequests = [newRequest, ...state.recentRequests].slice(0, 50);

          return {
            summary: newSummary,
            recentRequests,
          };
        });
      },

      resetSession: () => {
        set({
          summary: initialSummary,
          recentRequests: [],
        });
      },

      getSessionCost: () => get().summary.totalCost,
      getSessionTokens: () => get().summary.totalTokens,
    }),
    {
      name: 'family-memory-usage',
      partialize: (state) => ({
        summary: state.summary,
        recentRequests: state.recentRequests.slice(0, 20), // Only persist last 20
      }),
    }
  )
);

export default useUsageStore;
