/**
 * Unit tests for the Neo4j value-normalization helpers in graph.service.
 * The Neo4j driver session and logger are mocked — no database needed.
 */
jest.mock('../config/neo4j.js', () => ({
  getSession: jest.fn(),
  runQuery: jest.fn(),
}));

jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { toISODate, normalizeProps } from '../services/graph.service.js';

/** Fakes of the Neo4j driver's Integer and DateTime value objects. */
const neoInt = (n: number) => ({ toNumber: () => n });
const neoDate = (iso: string) => ({ toStandardDate: () => new Date(iso) });

describe('toISODate', () => {
  it('returns undefined for null and undefined', () => {
    expect(toISODate(null)).toBeUndefined();
    expect(toISODate(undefined)).toBeUndefined();
  });

  it('passes strings through unchanged', () => {
    expect(toISODate('2026-07-05T00:00:00.000Z')).toBe('2026-07-05T00:00:00.000Z');
  });

  it('converts Neo4j temporal values (toStandardDate) to ISO strings', () => {
    expect(toISODate(neoDate('2026-01-15T08:30:00.000Z'))).toBe('2026-01-15T08:30:00.000Z');
  });

  it('stringifies other values as a fallback', () => {
    expect(toISODate(42)).toBe('42');
  });
});

describe('normalizeProps', () => {
  it('converts Neo4j Integer-like values ({toNumber}) to JS numbers', () => {
    const out = normalizeProps({ count: neoInt(7), score: neoInt(0) } as any);
    expect(out).toEqual({ count: 7, score: 0 });
  });

  it('converts Neo4j temporal values to ISO strings', () => {
    const out = normalizeProps({ createdAt: neoDate('2025-12-31T23:59:59.000Z') } as any);
    expect(out.createdAt).toBe('2025-12-31T23:59:59.000Z');
  });

  it('passes plain strings, numbers, and booleans through unchanged', () => {
    const props = { name: 'Grandma Rose', age: 82, active: true };
    expect(normalizeProps(props)).toEqual(props);
  });

  it('preserves null values and leaves plain objects/arrays untouched', () => {
    const out = normalizeProps({ note: null, tags: ['a', 'b'], meta: { x: 1 } } as any);
    expect(out.note).toBeNull();
    expect(out.tags).toEqual(['a', 'b']);
    expect(out.meta).toEqual({ x: 1 });
  });

  it('handles mixed props in one pass ({low,high} structs never leak)', () => {
    const out = normalizeProps({
      id: 'abc',
      views: neoInt(1234),
      updatedAt: neoDate('2026-07-01T12:00:00.000Z'),
    } as any);
    expect(out).toEqual({
      id: 'abc',
      views: 1234,
      updatedAt: '2026-07-01T12:00:00.000Z',
    });
  });
});
