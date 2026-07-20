import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let client: QdrantClient;

const COLLECTIONS = {
  STORIES: 'stories',
  MEMORIES: 'memories',
  EPISODIC: 'episodic',
  PROCEDURAL: 'procedural',
};

// text-embedding-v3 returns 1024 dimensions (verified by API test)
const EMBEDDING_DIMENSIONS = 1024;

export async function initQdrant(): Promise<void> {
  client = new QdrantClient({
    url: config.qdrant.url,
    apiKey: config.qdrant.apiKey,
  });

  // Initialize collections with correct dimensions
  await ensureCollection(COLLECTIONS.STORIES, EMBEDDING_DIMENSIONS);
  await ensureCollection(COLLECTIONS.MEMORIES, EMBEDDING_DIMENSIONS);
  await ensureCollection(COLLECTIONS.EPISODIC, EMBEDDING_DIMENSIONS);
  await ensureCollection(COLLECTIONS.PROCEDURAL, EMBEDDING_DIMENSIONS);
}

async function ensureCollection(name: string, vectorSize: number): Promise<void> {
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === name);

    if (!exists) {
      await client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      logger.info(`Created Qdrant collection: ${name}`);
    }
  } catch (error) {
    logger.error(`Failed to ensure collection ${name}:`, error);
    throw error;
  }
}

export function getQdrantClient(): QdrantClient {
  if (!client) {
    throw new Error('Qdrant client not initialized. Call initQdrant() first.');
  }
  return client;
}

export { COLLECTIONS };
