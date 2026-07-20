/**
 * Global AI spend guard.
 *
 * Enforces a hard ceiling (config.qwen.maxTotalCostUsd, default $10) on the
 * cumulative cost of ALL Qwen API usage — chat, extraction, embeddings, and
 * image generation. The running total is persisted in Neo4j so restarts and
 * redeploys never reset the meter. When the ceiling is reached, every AI call
 * fails fast with a 429 before any tokens are spent.
 */
import { getSession } from '../config/neo4j.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error.middleware.js';

export class BudgetExceededError extends AppError {
  constructor(spent: number, limit: number) {
    super(
      429,
      'BUDGET_EXCEEDED',
      `Demo budget reached ($${spent.toFixed(2)} of $${limit.toFixed(2)}). ` +
      'AI features are paused for this deployment.'
    );
    this.name = 'BudgetExceededError';
  }
}

class BudgetService {
  private total = 0;
  private loadPromise: Promise<void> | null = null;

  private async load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const session = getSession();
          try {
            const result = await session.run(
              `MERGE (b:AiBudget {id: 'global'})
               ON CREATE SET b.totalUsd = 0.0
               RETURN b.totalUsd AS total`
            );
            const raw: any = result.records[0]?.get('total') ?? 0;
            // Neo4j may return an Integer/BigInt — normalize to a JS number
            this.total = typeof raw === 'object' && raw !== null && typeof raw.toNumber === 'function'
              ? raw.toNumber()
              : Number(raw);
            logger.info({ spentUsd: this.total, limitUsd: config.qwen.maxTotalCostUsd }, 'AI budget loaded');
          } finally {
            await session.close();
          }
        } catch (error) {
          // If Neo4j is unreachable we start from 0 in memory; spend is still capped.
          logger.warn({ error: (error as Error).message }, 'Could not load AI budget total; starting from 0');
        }
      })();
    }
    return this.loadPromise;
  }

  /** Throws BudgetExceededError when the cumulative spend has hit the limit. */
  async assertWithinBudget(): Promise<void> {
    await this.load();
    if (this.total >= config.qwen.maxTotalCostUsd) {
      throw new BudgetExceededError(this.total, config.qwen.maxTotalCostUsd);
    }
  }

  /** Record spend in memory immediately and persist asynchronously. */
  recordSpend(usd: number): void {
    if (!usd || usd <= 0 || !Number.isFinite(usd)) return;
    this.total += usd;
    const session = getSession();
    session
      .run(
        `MERGE (b:AiBudget {id: 'global'})
         ON CREATE SET b.totalUsd = 0.0
         SET b.totalUsd = b.totalUsd + $usd`,
        { usd }
      )
      .catch((error) => logger.warn({ error: error.message }, 'Failed to persist AI budget spend'))
      .finally(() => session.close());
  }

  async getStatus(): Promise<{ spentUsd: number; limitUsd: number; remainingUsd: number }> {
    await this.load();
    return {
      spentUsd: this.total,
      limitUsd: config.qwen.maxTotalCostUsd,
      remainingUsd: Math.max(0, config.qwen.maxTotalCostUsd - this.total),
    };
  }
}

export const budgetService = new BudgetService();
