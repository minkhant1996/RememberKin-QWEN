/**
 * Database Test Suite
 *
 * Tests Neo4j and Qdrant database operations directly.
 * Run with: npx ts-node database-tests.ts
 *
 * Prerequisites:
 * - Neo4j database accessible
 * - Qdrant database accessible
 * - Environment variables configured
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuid } from 'uuid';

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

let neo4jDriver: Driver;
let qdrantClient: QdrantClient;

// Test context
const ctx = {
  personId: '',
  familyId: '',
  storyId: '',
  memoryId: '',
  eventId: '',
};

// Helpers
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✓ ${name}`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      duration: Date.now() - start,
    });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============ NEO4J TESTS ============

async function testNeo4jConnection() {
  console.log('\n--- Neo4j Connection Tests ---\n');

  await test('Connect to Neo4j', async () => {
    neo4jDriver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
    );
    const session = neo4jDriver.session();
    try {
      const result = await session.run('RETURN 1 as n');
      assertEqual(result.records[0].get('n').toNumber(), 1, 'Query result');
    } finally {
      await session.close();
    }
  });
}

async function testNeo4jNodes() {
  console.log('\n--- Neo4j Node Tests ---\n');

  await test('Create Person node', async () => {
    const session = neo4jDriver.session();
    try {
      ctx.personId = uuid();
      const result = await session.run(
        `
        CREATE (p:Person {
          id: $id,
          name: $name,
          email: $email,
          createdAt: datetime()
        })
        RETURN p
        `,
        {
          id: ctx.personId,
          name: 'Test Person',
          email: `test-${Date.now()}@example.com`,
        }
      );
      assert(result.records.length === 1, 'Should create one node');
      assertEqual(
        result.records[0].get('p').properties.id,
        ctx.personId,
        'Person ID'
      );
    } finally {
      await session.close();
    }
  });

  await test('Create Family node', async () => {
    const session = neo4jDriver.session();
    try {
      ctx.familyId = uuid();
      const result = await session.run(
        `
        CREATE (f:Family {
          id: $id,
          name: $name,
          createdAt: datetime()
        })
        RETURN f
        `,
        { id: ctx.familyId, name: 'Test Family' }
      );
      assert(result.records.length === 1, 'Should create one node');
    } finally {
      await session.close();
    }
  });

  await test('Create Story node', async () => {
    const session = neo4jDriver.session();
    try {
      ctx.storyId = uuid();
      const result = await session.run(
        `
        CREATE (s:Story {
          id: $id,
          content: $content,
          summary: $summary,
          mood: $mood,
          topics: $topics,
          createdAt: datetime()
        })
        RETURN s
        `,
        {
          id: ctx.storyId,
          content: 'Test story content',
          summary: 'Test summary',
          mood: 'happy',
          topics: ['test', 'family'],
        }
      );
      assert(result.records.length === 1, 'Should create one node');
    } finally {
      await session.close();
    }
  });

  await test('Create Memory node', async () => {
    const session = neo4jDriver.session();
    try {
      ctx.memoryId = uuid();
      const result = await session.run(
        `
        CREATE (m:Memory {
          id: $id,
          fact: $fact,
          confidence: $confidence,
          createdAt: datetime()
        })
        RETURN m
        `,
        {
          id: ctx.memoryId,
          fact: 'Test fact',
          confidence: 0.95,
        }
      );
      assert(result.records.length === 1, 'Should create one node');
    } finally {
      await session.close();
    }
  });

  await test('Create Event node', async () => {
    const session = neo4jDriver.session();
    try {
      ctx.eventId = uuid();
      const result = await session.run(
        `
        CREATE (e:Event {
          id: $id,
          type: $type,
          title: $title,
          date: date($date),
          recurring: $recurring,
          createdAt: datetime()
        })
        RETURN e
        `,
        {
          id: ctx.eventId,
          type: 'birthday',
          title: 'Test Birthday',
          date: '2025-06-15',
          recurring: true,
        }
      );
      assert(result.records.length === 1, 'Should create one node');
    } finally {
      await session.close();
    }
  });
}

async function testNeo4jRelationships() {
  console.log('\n--- Neo4j Relationship Tests ---\n');

  await test('Create MEMBER_OF relationship', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (p:Person {id: $personId}), (f:Family {id: $familyId})
        CREATE (p)-[r:MEMBER_OF]->(f)
        RETURN r
        `,
        { personId: ctx.personId, familyId: ctx.familyId }
      );
      assert(result.records.length === 1, 'Should create relationship');
    } finally {
      await session.close();
    }
  });

  await test('Create TOLD_STORY relationship', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (p:Person {id: $personId}), (s:Story {id: $storyId})
        CREATE (p)-[r:TOLD_STORY {date: datetime()}]->(s)
        RETURN r
        `,
        { personId: ctx.personId, storyId: ctx.storyId }
      );
      assert(result.records.length === 1, 'Should create relationship');
    } finally {
      await session.close();
    }
  });

  await test('Create ABOUT relationship', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (m:Memory {id: $memoryId}), (p:Person {id: $personId})
        CREATE (m)-[r:ABOUT]->(p)
        RETURN r
        `,
        { memoryId: ctx.memoryId, personId: ctx.personId }
      );
      assert(result.records.length === 1, 'Should create relationship');
    } finally {
      await session.close();
    }
  });

  await test('Create INVOLVES relationship', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (e:Event {id: $eventId}), (p:Person {id: $personId})
        CREATE (e)-[r:INVOLVES]->(p)
        RETURN r
        `,
        { eventId: ctx.eventId, personId: ctx.personId }
      );
      assert(result.records.length === 1, 'Should create relationship');
    } finally {
      await session.close();
    }
  });

  await test('Create MENTIONS relationship', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (s:Story {id: $storyId}), (p:Person {id: $personId})
        CREATE (s)-[r:MENTIONS]->(p)
        RETURN r
        `,
        { storyId: ctx.storyId, personId: ctx.personId }
      );
      assert(result.records.length === 1, 'Should create relationship');
    } finally {
      await session.close();
    }
  });
}

async function testNeo4jQueries() {
  console.log('\n--- Neo4j Query Tests ---\n');

  await test('Query family members', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(p:Person)
        RETURN p
        `,
        { familyId: ctx.familyId }
      );
      assert(result.records.length > 0, 'Should find members');
    } finally {
      await session.close();
    }
  });

  await test('Query stories with author', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (author:Person)-[:TOLD_STORY]->(s:Story {id: $storyId})
        RETURN s, author
        `,
        { storyId: ctx.storyId }
      );
      assert(result.records.length === 1, 'Should find story');
      assert(result.records[0].get('author'), 'Should have author');
    } finally {
      await session.close();
    }
  });

  await test('Query memories about person', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (m:Memory)-[:ABOUT]->(p:Person {id: $personId})
        RETURN m
        `,
        { personId: ctx.personId }
      );
      assert(result.records.length > 0, 'Should find memories');
    } finally {
      await session.close();
    }
  });

  await test('Query upcoming events', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (e:Event)-[:INVOLVES]->(p:Person {id: $personId})
        WHERE e.date >= date()
        RETURN e
        ORDER BY e.date
        `,
        { personId: ctx.personId }
      );
      assert(result.records.length > 0, 'Should find events');
    } finally {
      await session.close();
    }
  });

  await test('Query story mentions', async () => {
    const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `
        MATCH (s:Story {id: $storyId})-[:MENTIONS]->(p:Person)
        RETURN p
        `,
        { storyId: ctx.storyId }
      );
      assert(result.records.length > 0, 'Should find mentions');
    } finally {
      await session.close();
    }
  });
}

async function testNeo4jCleanup() {
  console.log('\n--- Neo4j Cleanup Tests ---\n');

  await test('Delete test nodes and relationships', async () => {
    const session = neo4jDriver.session();
    try {
      // Delete in order respecting relationships
      await session.run(
        `MATCH (m:Memory {id: $id}) DETACH DELETE m`,
        { id: ctx.memoryId }
      );
      await session.run(
        `MATCH (e:Event {id: $id}) DETACH DELETE e`,
        { id: ctx.eventId }
      );
      await session.run(
        `MATCH (s:Story {id: $id}) DETACH DELETE s`,
        { id: ctx.storyId }
      );
      await session.run(
        `MATCH (p:Person {id: $id}) DETACH DELETE p`,
        { id: ctx.personId }
      );
      await session.run(
        `MATCH (f:Family {id: $id}) DETACH DELETE f`,
        { id: ctx.familyId }
      );
    } finally {
      await session.close();
    }
  });
}

// ============ QDRANT TESTS ============

async function testQdrantConnection() {
  console.log('\n--- Qdrant Connection Tests ---\n');

  await test('Connect to Qdrant', async () => {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
    const collections = await qdrantClient.getCollections();
    assert(Array.isArray(collections.collections), 'Should return collections');
  });
}

async function testQdrantCollections() {
  console.log('\n--- Qdrant Collection Tests ---\n');

  const testCollection = `test_collection_${Date.now()}`;

  await test('Create collection', async () => {
    await qdrantClient.createCollection(testCollection, {
      vectors: { size: 4, distance: 'Cosine' },
    });
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === testCollection);
    assert(exists, 'Collection should exist');
  });

  await test('Insert vectors', async () => {
    await qdrantClient.upsert(testCollection, {
      points: [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3, 0.4],
          payload: { text: 'test document 1', family_id: 'fam-1' },
        },
        {
          id: 2,
          vector: [0.2, 0.3, 0.4, 0.5],
          payload: { text: 'test document 2', family_id: 'fam-1' },
        },
        {
          id: 3,
          vector: [0.9, 0.8, 0.7, 0.6],
          payload: { text: 'different document', family_id: 'fam-2' },
        },
      ],
    });
  });

  await test('Search vectors by similarity', async () => {
    const results = await qdrantClient.search(testCollection, {
      vector: [0.15, 0.25, 0.35, 0.45],
      limit: 2,
    });
    assert(results.length === 2, 'Should return 2 results');
    assert(results[0].score > results[1].score, 'Results should be sorted');
  });

  await test('Search with filter', async () => {
    const results = await qdrantClient.search(testCollection, {
      vector: [0.1, 0.2, 0.3, 0.4],
      limit: 10,
      filter: {
        must: [{ key: 'family_id', match: { value: 'fam-1' } }],
      },
    });
    assert(results.length === 2, 'Should return only fam-1 documents');
  });

  await test('Delete vectors', async () => {
    await qdrantClient.delete(testCollection, {
      points: [1],
    });
    const results = await qdrantClient.search(testCollection, {
      vector: [0.1, 0.2, 0.3, 0.4],
      limit: 10,
    });
    const ids = results.map((r) => r.id);
    assert(!ids.includes(1), 'ID 1 should be deleted');
  });

  await test('Delete collection', async () => {
    await qdrantClient.deleteCollection(testCollection);
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === testCollection);
    assert(!exists, 'Collection should be deleted');
  });
}

// ============ MAIN ============

async function main() {
  console.log('=====================================');
  console.log('  Rememberkin Database Tests');
  console.log('=====================================');
  console.log(`\nNeo4j: ${NEO4J_URI}`);
  console.log(`Qdrant: ${QDRANT_URL}\n`);

  try {
    // Neo4j tests
    await testNeo4jConnection();
    await testNeo4jNodes();
    await testNeo4jRelationships();
    await testNeo4jQueries();
    await testNeo4jCleanup();

    // Qdrant tests
    await testQdrantConnection();
    await testQdrantCollections();
  } catch (error: any) {
    console.error('\nFatal error:', error.message);
  } finally {
    // Cleanup
    if (neo4jDriver) {
      await neo4jDriver.close();
    }
  }

  // Summary
  console.log('\n=====================================');
  console.log('  Test Summary');
  console.log('=====================================\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log('\nAll tests passed!');
  process.exit(0);
}

main();
