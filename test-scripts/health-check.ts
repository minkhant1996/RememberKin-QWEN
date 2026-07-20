/**
 * Health Check Script
 *
 * Quickly verifies all services are running and accessible.
 * Run with: npx ts-node health-check.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:6100';
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error';
  message: string;
  latency?: number;
}

async function checkService(
  name: string,
  checkFn: () => Promise<void>
): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await checkFn();
    return {
      name,
      status: 'ok',
      message: 'Connected',
      latency: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name,
      status: 'error',
      message: error.message,
    };
  }
}

async function checkBackend(): Promise<void> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json() as { status: string };
  if (data.status !== 'ok') {
    throw new Error('Health check failed');
  }
}

async function checkNeo4j(): Promise<void> {
  const neo4j = await import('neo4j-driver');
  const driver = neo4j.default.driver(
    NEO4J_URI,
    neo4j.default.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'password'
    )
  );
  const session = driver.session();
  try {
    await session.run('RETURN 1');
  } finally {
    await session.close();
    await driver.close();
  }
}

async function checkQdrant(): Promise<void> {
  const response = await fetch(`${QDRANT_URL}/collections`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function main() {
  console.log('=========================================');
  console.log('  Rememberkin - Health Check');
  console.log('=========================================\n');

  const checks: Promise<ServiceStatus>[] = [
    checkService('Backend API', checkBackend),
    checkService('Neo4j Database', checkNeo4j),
    checkService('Qdrant Vector DB', checkQdrant),
  ];

  const results = await Promise.all(checks);

  // Print results
  let allHealthy = true;
  results.forEach((result) => {
    const icon = result.status === 'ok' ? '✓' : '✗';
    const latency = result.latency ? ` (${result.latency}ms)` : '';
    console.log(`${icon} ${result.name}: ${result.message}${latency}`);
    if (result.status === 'error') {
      allHealthy = false;
    }
  });

  console.log('\n-----------------------------------------');
  if (allHealthy) {
    console.log('All services are healthy!');
    process.exit(0);
  } else {
    console.log('Some services are unhealthy!');
    process.exit(1);
  }
}

main();
