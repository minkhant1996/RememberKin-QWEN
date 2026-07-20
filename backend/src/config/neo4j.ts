import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let driver: Driver;

export async function initNeo4j(): Promise<void> {
  driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
  );

  // Verify connectivity
  await driver.verifyConnectivity();
}

export function getDriver(): Driver {
  if (!driver) {
    throw new Error('Neo4j driver not initialized. Call initNeo4j() first.');
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    logger.info('Neo4j connection closed');
  }
}

// Helper to run a query with automatic session management
export async function runQuery<T>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = getSession();
  try {
    const result = await session.run(query, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}
