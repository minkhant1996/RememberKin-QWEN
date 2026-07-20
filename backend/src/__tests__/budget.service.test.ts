/**
 * Unit tests for the global AI spend guard (BudgetService).
 * Neo4j, config, and the logger are mocked — no external services needed.
 */
const mockRun = jest.fn();
const mockClose = jest.fn();

jest.mock('../config/neo4j.js', () => ({
  getSession: () => ({ run: mockRun, close: mockClose }),
}));

jest.mock('../config/index.js', () => ({
  config: { qwen: { maxTotalCostUsd: 10 } },
}));

jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

type BudgetModule = typeof import('../services/budget.service.js');

/** Returns a fresh BudgetService singleton so state never leaks between tests. */
async function freshModule(): Promise<BudgetModule> {
  jest.resetModules();
  return import('../services/budget.service.js');
}

function stubStoredTotal(total: unknown) {
  mockRun.mockResolvedValue({ records: [{ get: () => total }] });
  mockClose.mockResolvedValue(undefined);
}

describe('BudgetService', () => {
  it('getStatus returns the spent/limit/remaining shape', async () => {
    stubStoredTotal(0);
    const { budgetService } = await freshModule();

    const status = await budgetService.getStatus();
    expect(status).toEqual({ spentUsd: 0, limitUsd: 10, remainingUsd: 10 });
  });

  it('normalizes a Neo4j Integer-like stored total via toNumber()', async () => {
    stubStoredTotal({ toNumber: () => 2.5 });
    const { budgetService } = await freshModule();

    const status = await budgetService.getStatus();
    expect(status.spentUsd).toBe(2.5);
    expect(status.remainingUsd).toBe(7.5);
  });

  it('assertWithinBudget resolves while under the limit', async () => {
    stubStoredTotal(9.99);
    const { budgetService } = await freshModule();

    await expect(budgetService.assertWithinBudget()).resolves.toBeUndefined();
  });

  it('assertWithinBudget throws BudgetExceededError (429) at or over the limit', async () => {
    stubStoredTotal(10);
    const { budgetService, BudgetExceededError } = await freshModule();

    const error = await budgetService.assertWithinBudget().catch((e) => e);
    expect(error).toBeInstanceOf(BudgetExceededError);
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('BUDGET_EXCEEDED');
  });

  it('recordSpend accumulates in memory and persists the increment', async () => {
    stubStoredTotal(0);
    const { budgetService } = await freshModule();
    await budgetService.getStatus(); // force the initial load

    budgetService.recordSpend(2);
    budgetService.recordSpend(0.5);

    const status = await budgetService.getStatus();
    expect(status.spentUsd).toBeCloseTo(2.5);
    expect(status.remainingUsd).toBeCloseTo(7.5);
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('AiBudget'), { usd: 2 });
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('AiBudget'), { usd: 0.5 });
  });

  it('recordSpend ignores zero, negative, and non-finite amounts', async () => {
    stubStoredTotal(0);
    const { budgetService } = await freshModule();
    await budgetService.getStatus();
    mockRun.mockClear();

    budgetService.recordSpend(0);
    budgetService.recordSpend(-1);
    budgetService.recordSpend(NaN);

    expect(mockRun).not.toHaveBeenCalled();
    expect((await budgetService.getStatus()).spentUsd).toBe(0);
  });

  it('falls back to $0 spent when Neo4j is unreachable at load time', async () => {
    mockRun.mockRejectedValue(new Error('connection refused'));
    mockClose.mockResolvedValue(undefined);
    const { budgetService } = await freshModule();

    const status = await budgetService.getStatus();
    expect(status).toEqual({ spentUsd: 0, limitUsd: 10, remainingUsd: 10 });
  });
});
