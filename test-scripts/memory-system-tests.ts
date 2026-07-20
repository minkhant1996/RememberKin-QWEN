/**
 * Memory System Test Suite
 *
 * Tests the 4-layer cognitive memory system:
 * 1. Working Memory - Session-scoped fact extraction
 * 2. Episodic Memory - Conversation episodes
 * 3. Semantic Memory - Consolidated long-term facts
 * 4. Procedural Memory - Learned patterns
 *
 * Run with: npx ts-node memory-system-tests.ts
 *
 * Prerequisites:
 * - Backend server running on localhost:6100
 * - Neo4j and Qdrant databases connected
 * - Qwen API key configured
 */

const BASE_URL = process.env.API_URL || 'http://localhost:6100/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface TestContext {
  token?: string;
  userId?: string;
  familyId?: string;
  sessionId?: string;
  memberId?: string;
}

const ctx: TestContext = {};
const results: TestResult[] = [];

// Helper: Make HTTP request
async function request(
  method: string,
  path: string,
  body?: object,
  token?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

// Helper: Run a test
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

// Helper: Assert
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// Helper: Sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ SETUP: Create Family with Members ============

async function setupFamilyWithMembers() {
  console.log('\n========================================');
  console.log('MEMORY SYSTEM TEST SUITE');
  console.log('========================================\n');
  console.log('--- Setup: Creating Test Family ---\n');

  const timestamp = Date.now();
  const testEmail = `memory-test-${timestamp}@example.com`;
  const testPassword = 'testpassword123';

  // Register user
  await test('Register test user', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });
    assert(status === 201 || status === 200, `Expected 201/200, got ${status}`);
    ctx.token = data.token;
    ctx.userId = data.user.id;
    console.log(`  User ID: ${ctx.userId}`);
  });

  // Create family
  await test('Create family: The Johnson Family', async () => {
    const { status, data } = await request(
      'POST',
      '/family',
      { name: 'The Johnson Family' },
      ctx.token
    );
    assert(status === 201 || status === 200, `Expected 201/200, got ${status}`);
    ctx.familyId = data.id || data.family?.id;
    console.log(`  Family ID: ${ctx.familyId}`);
  });

  // Add family members
  const members = [
    { name: 'Grandma Rose', nickname: 'Grandma', birthDate: '1945-03-15' },
    { name: 'Uncle Joe', nickname: 'Joe', birthDate: '1970-07-22' },
    { name: 'Sarah Johnson', nickname: 'Mom', birthDate: '1975-11-30' },
  ];

  for (const member of members) {
    await test(`Add family member: ${member.name}`, async () => {
      const { status, data } = await request(
        'POST',
        '/members',
        member,
        ctx.token
      );
      assert(status === 201 || status === 200, `Expected 201/200, got ${status}`);
      if (member.name === 'Grandma Rose') {
        ctx.memberId = data.id || data.member?.id;
      }
      console.log(`  Member: ${member.name}`);
    });
  }
}

// ============ TEST 1: Working Memory - Fact Extraction ============

async function testWorkingMemory() {
  console.log('\n--- Test 1: Working Memory (Fact Extraction) ---\n');

  // Initial stats check
  await test('Get initial memory stats', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/stats',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Working: ${data.working.count} sessions, ${data.working.pendingFacts} pending facts`);
    console.log(`  Episodic: ${data.episodic.count} episodes`);
    console.log(`  Semantic: ${data.semantic.count} facts`);
    console.log(`  Procedural: ${data.procedural.count} patterns`);
  });

  // Chat conversation 1: Extract facts about Grandma
  await test('Chat: Extract facts about Grandma Rose', async () => {
    const { status, data } = await request(
      'POST',
      '/chat',
      {
        message: "Grandma Rose loves apple pie and she always bakes it on Sundays. She was born in Boston and moved to California in 1970.",
        history: [],
      },
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    ctx.sessionId = data.sessionId;
    console.log(`  Session ID: ${ctx.sessionId}`);
    console.log(`  Response: ${data.response?.substring(0, 100)}...`);
  });

  // Wait for async processing
  await sleep(2000);

  // Check working memory for extracted facts
  await test('Check working memory for pending facts', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/working',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Sessions: ${data.sessions}`);
    console.log(`  Pending facts: ${data.pendingFacts?.length || 0}`);
    if (data.pendingFacts && data.pendingFacts.length > 0) {
      data.pendingFacts.forEach((f: any) => {
        console.log(`    - "${f.fact}" about ${f.aboutName} (${Math.round(f.confidence * 100)}%)`);
      });
    }
    console.log(`  Active entities: ${data.activeEntities?.length || 0}`);
  });

  // Chat conversation 2: More facts about Uncle Joe
  await test('Chat: Extract facts about Uncle Joe', async () => {
    const { status, data } = await request(
      'POST',
      '/chat',
      {
        message: "Uncle Joe is a mechanic and he loves vintage cars. He always fixes the family cars for free. His favorite food is pizza.",
        sessionId: ctx.sessionId,
        history: [
          { role: 'user' as const, content: "Grandma Rose loves apple pie" },
          { role: 'assistant' as const, content: "That's lovely!" }
        ],
      },
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Response: ${data.response?.substring(0, 100)}...`);
  });

  await sleep(2000);

  // Check updated working memory
  await test('Check updated working memory', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/working',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Total pending facts: ${data.pendingFacts?.length || 0}`);
    console.log(`  Total active entities: ${data.activeEntities?.length || 0}`);
  });
}

// ============ TEST 2: Episodic Memory ============

async function testEpisodicMemory() {
  console.log('\n--- Test 2: Episodic Memory ---\n');

  await test('Get episodic memories', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/episodic',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Total episodes: ${data.total}`);
    if (data.memories && data.memories.length > 0) {
      data.memories.forEach((ep: any) => {
        console.log(`    - ${ep.eventType}: importance ${Math.round(ep.importance * 100)}%, accessed ${ep.accessCount}x`);
        if (ep.extractedFacts && ep.extractedFacts.length > 0) {
          console.log(`      Facts: ${ep.extractedFacts.slice(0, 2).join('; ')}...`);
        }
      });
    }
  });

  // Check consolidation candidates
  await test('Get consolidation queue', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/consolidation-queue',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Candidates for consolidation: ${data.total}`);
    if (data.candidates && data.candidates.length > 0) {
      data.candidates.slice(0, 5).forEach((c: any) => {
        console.log(`    - "${c.fact}" about ${c.aboutName} (${c.mentionCount} mentions, ${Math.round(c.suggestedConfidence * 100)}% confidence)`);
      });
    }
  });
}

// ============ TEST 3: Consolidation ============

async function testConsolidation() {
  console.log('\n--- Test 3: Memory Consolidation ---\n');

  // Trigger consolidation
  await test('Trigger memory consolidation', async () => {
    const { status, data } = await request(
      'POST',
      '/memory-dashboard/consolidate',
      {},
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Consolidation should succeed');
    console.log(`  Processed: ${data.result.processed}`);
    console.log(`  Consolidated: ${data.result.consolidated}`);
    console.log(`  Reinforced: ${data.result.reinforced}`);
    console.log(`  Skipped: ${data.result.skipped}`);

    if (data.activities && data.activities.length > 0) {
      console.log(`  Activities generated: ${data.activities.length}`);
    }
  });

  // Check semantic memories
  await test('Get semantic memories after consolidation', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/semantic',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Total semantic memories: ${data.total}`);
    if (data.memories && data.memories.length > 0) {
      data.memories.forEach((m: any) => {
        console.log(`    - [${m.factType}] "${m.fact}" about ${m.aboutName} (${Math.round(m.confidence * 100)}%, reinforced ${m.reinforcementCount}x)`);
      });
    }
  });
}

// ============ TEST 4: Memory Reinforcement ============

async function testReinforcement() {
  console.log('\n--- Test 4: Memory Reinforcement ---\n');

  // Mention same fact again
  await test('Chat: Mention Grandma apple pie again (reinforcement)', async () => {
    const { status, data } = await request(
      'POST',
      '/chat',
      {
        message: "Remember how Grandma Rose makes the best apple pie? I really miss her Sunday baking.",
        sessionId: ctx.sessionId,
        history: [],
      },
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Response: ${data.response?.substring(0, 100)}...`);
  });

  await sleep(2000);

  // Consolidate again to trigger reinforcement
  await test('Consolidate to reinforce existing memories', async () => {
    const { status, data } = await request(
      'POST',
      '/memory-dashboard/consolidate',
      {},
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Reinforced memories: ${data.result.reinforced}`);
  });

  // Check reinforcement count increased
  await test('Verify memory was reinforced', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/semantic',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    const reinforcedMemories = data.memories?.filter((m: any) => m.reinforcementCount > 1) || [];
    console.log(`  Memories with reinforcement > 1: ${reinforcedMemories.length}`);
    reinforcedMemories.forEach((m: any) => {
      console.log(`    - "${m.fact}" (reinforced ${m.reinforcementCount}x, confidence ${Math.round(m.confidence * 100)}%)`);
    });
  });
}

// ============ TEST 5: Pattern Detection ============

async function testPatternDetection() {
  console.log('\n--- Test 5: Procedural Memory (Pattern Detection) ---\n');

  // Trigger pattern detection
  await test('Trigger pattern detection', async () => {
    const { status, data } = await request(
      'POST',
      '/memory-dashboard/detect-patterns',
      {},
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Patterns found: ${data.result.patternsFound}`);
    console.log(`  New patterns: ${data.result.newPatternsCount}`);
    console.log(`  Reinforced patterns: ${data.result.reinforcedPatternsCount}`);

    if (data.newPatterns && data.newPatterns.length > 0) {
      data.newPatterns.forEach((p: any) => {
        console.log(`    - ${p.name}: ${p.description}`);
      });
    }
  });

  // Get procedural memories
  await test('Get procedural memories', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/procedural',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Total patterns: ${data.total}`);
    if (data.patterns && data.patterns.length > 0) {
      data.patterns.forEach((p: any) => {
        console.log(`    - [${p.patternType}] ${p.name}`);
        console.log(`      Trigger: ${p.trigger}`);
        console.log(`      Action: ${p.action}`);
        console.log(`      Confidence: ${Math.round(p.confidence * 100)}%`);
      });
    }
  });
}

// ============ TEST 6: Activity Feed ============

async function testActivityFeed() {
  console.log('\n--- Test 6: Activity Feed ---\n');

  await test('Get memory activity feed', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/activity?limit=20',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Total activities: ${data.total}`);
    if (data.activities && data.activities.length > 0) {
      data.activities.slice(0, 10).forEach((a: any) => {
        const fromTo = a.fromLayer && a.toLayer ? ` (${a.fromLayer} → ${a.toLayer})` : '';
        console.log(`    - [${a.type}]${fromTo}: ${a.description}`);
      });
    }
  });
}

// ============ TEST 7: Memory Decay ============

async function testMemoryDecay() {
  console.log('\n--- Test 7: Memory Decay ---\n');

  // Get current stats
  await test('Get stats before decay', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/semantic',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    if (data.memories && data.memories.length > 0) {
      const avgConfidence = data.memories.reduce((sum: number, m: any) => sum + m.confidence, 0) / data.memories.length;
      console.log(`  Avg confidence before decay: ${Math.round(avgConfidence * 100)}%`);
    }
  });

  // Apply decay
  await test('Apply memory decay (5%)', async () => {
    const { status, data } = await request(
      'POST',
      '/memory-dashboard/apply-decay',
      { decayAmount: 0.05 },
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Memories affected: ${data.decayedCount}`);
  });

  // Check stats after decay
  await test('Get stats after decay', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/semantic',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    if (data.memories && data.memories.length > 0) {
      const avgConfidence = data.memories.reduce((sum: number, m: any) => sum + m.confidence, 0) / data.memories.length;
      console.log(`  Avg confidence after decay: ${Math.round(avgConfidence * 100)}%`);
    }
  });
}

// ============ TEST 8: Final Stats ============

async function testFinalStats() {
  console.log('\n--- Final Memory Statistics ---\n');

  await test('Get final memory stats', async () => {
    const { status, data } = await request(
      'GET',
      '/memory-dashboard/stats',
      undefined,
      ctx.token
    );
    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`  Working Memory:`);
    console.log(`    - Sessions: ${data.working.count}`);
    console.log(`    - Pending facts: ${data.working.pendingFacts}`);
    console.log(`    - Active entities: ${data.working.activeEntities}`);
    console.log(`  Episodic Memory:`);
    console.log(`    - Episodes: ${data.episodic.count}`);
    console.log(`    - Unconsolidated: ${data.episodic.unconsolidated}`);
    console.log(`    - Avg importance: ${Math.round(data.episodic.avgImportance * 100)}%`);
    console.log(`  Semantic Memory:`);
    console.log(`    - Facts: ${data.semantic.count}`);
    console.log(`    - Avg confidence: ${Math.round(data.semantic.avgConfidence * 100)}%`);
    console.log(`    - Total reinforcements: ${data.semantic.totalReinforcements}`);
    console.log(`  Procedural Memory:`);
    console.log(`    - Patterns: ${data.procedural.count}`);
    console.log(`    - Avg confidence: ${Math.round(data.procedural.avgConfidence * 100)}%`);
  });
}

// ============ MAIN ============

async function main() {
  try {
    // Setup
    await setupFamilyWithMembers();

    // Run tests
    await testWorkingMemory();
    await testEpisodicMemory();
    await testConsolidation();
    await testReinforcement();
    await testPatternDetection();
    await testActivityFeed();
    await testMemoryDecay();
    await testFinalStats();

    // Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total: ${results.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${totalTime}ms`);

    if (failed > 0) {
      console.log('\nFailed tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

main();
