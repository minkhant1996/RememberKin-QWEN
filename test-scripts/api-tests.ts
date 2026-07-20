/**
 * API Test Suite
 *
 * Tests all REST API endpoints for the Rememberkin backend.
 * Run with: npx ts-node api-tests.ts
 *
 * Prerequisites:
 * - Backend server running on localhost:6100
 * - Neo4j and Qdrant databases connected
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
  storyId?: string;
  eventId?: string;
  memoryId?: string;
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

// ============ AUTH TESTS ============

async function testAuth() {
  console.log('\n--- Authentication Tests ---\n');

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  await test('Register new user', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });
    assertEqual(status, 201, 'Status code');
    assert(data.token, 'Token should be returned');
    assert(data.user.id, 'User ID should be returned');
    ctx.token = data.token;
    ctx.userId = data.user.id;
  });

  await test('Register duplicate email fails', async () => {
    const { status } = await request('POST', '/auth/register', {
      email: testEmail,
      password: testPassword,
      name: 'Test User 2',
    });
    assertEqual(status, 409, 'Status code');
  });

  await test('Register invalid email fails', async () => {
    const { status } = await request('POST', '/auth/register', {
      email: 'not-an-email',
      password: testPassword,
      name: 'Test User',
    });
    assertEqual(status, 400, 'Status code');
  });

  await test('Login with valid credentials', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    assertEqual(status, 200, 'Status code');
    assert(data.token, 'Token should be returned');
    ctx.token = data.token;
  });

  await test('Login with wrong password fails', async () => {
    const { status } = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'wrongpassword',
    });
    assertEqual(status, 401, 'Status code');
  });

  await test('Access protected route without token fails', async () => {
    const { status } = await request('GET', '/family');
    assertEqual(status, 401, 'Status code');
  });

  await test('Access protected route with token succeeds', async () => {
    const { status } = await request('GET', '/family', undefined, ctx.token);
    assert(status === 200 || status === 404, 'Status should be 200 or 404');
  });
}

// ============ FAMILY TESTS ============

async function testFamily() {
  console.log('\n--- Family Tests ---\n');

  await test('Create family', async () => {
    const { status, data } = await request(
      'POST',
      '/family',
      { name: 'Test Family' },
      ctx.token
    );
    assertEqual(status, 201, 'Status code');
    assert(data.id, 'Family ID should be returned');
    ctx.familyId = data.id;
  });

  await test('Get family', async () => {
    const { status, data } = await request('GET', '/family', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    assertEqual(data.name, 'Test Family', 'Family name');
  });

  await test('Get family tree', async () => {
    const { status, data } = await request('GET', '/family/tree', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.nodes), 'Nodes should be array');
    assert(Array.isArray(data.edges), 'Edges should be array');
  });
}

// ============ MEMBER TESTS ============

async function testMembers() {
  console.log('\n--- Member Tests ---\n');

  await test('List family members', async () => {
    const { status, data } = await request('GET', '/members', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.members), 'Members should be array');
    assert(data.members.length > 0, 'Should have at least one member');
  });

  await test('Get member by ID', async () => {
    const { status, data } = await request(
      'GET',
      `/members/${ctx.userId}`,
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(data.name, 'Member should have name');
  });

  await test('Update own profile', async () => {
    const { status, data } = await request(
      'PUT',
      `/members/${ctx.userId}`,
      { nickname: 'Testy' },
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assertEqual(data.nickname, 'Testy', 'Nickname updated');
  });

  await test('Get non-existent member fails', async () => {
    const { status } = await request(
      'GET',
      '/members/non-existent-id',
      undefined,
      ctx.token
    );
    assertEqual(status, 404, 'Status code');
  });
}

// ============ STORY TESTS ============

async function testStories() {
  console.log('\n--- Story Tests ---\n');

  await test('Create story', async () => {
    const { status, data } = await request(
      'POST',
      '/stories',
      {
        content:
          'My grandmother Rose used to bake the most amazing apple pies every Sunday. The whole house would smell like cinnamon and love.',
        authorId: ctx.userId,
        visibility: { type: 'public' },
      },
      ctx.token
    );
    assertEqual(status, 201, 'Status code');
    assert(data.id, 'Story ID should be returned');
    assert(data.summary, 'Summary should be generated');
    assert(data.mood, 'Mood should be extracted');
    assert(Array.isArray(data.topics), 'Topics should be array');
    ctx.storyId = data.id;
  });

  await test('List stories', async () => {
    const { status, data } = await request('GET', '/stories', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.stories), 'Stories should be array');
    assert(data.pagination, 'Pagination should be present');
    assert(data.pagination.total > 0, 'Total should be > 0');
  });

  await test('Get single story', async () => {
    const { status, data } = await request(
      'GET',
      `/stories/${ctx.storyId}`,
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(data.content, 'Story should have content');
    assert(data.author, 'Story should have author');
  });

  await test('React to story', async () => {
    const { status, data } = await request(
      'POST',
      `/stories/${ctx.storyId}/react`,
      { emoji: '❤️' },
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assertEqual(data.emoji, '❤️', 'Emoji should match');
  });

  await test('Get story reactions', async () => {
    const { status, data } = await request(
      'GET',
      `/stories/${ctx.storyId}/reactions`,
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.reactions), 'Reactions should be array');
    assert(data.reactions.length > 0, 'Should have at least one reaction');
  });

  await test('Remove reaction', async () => {
    const { status } = await request(
      'DELETE',
      `/stories/${ctx.storyId}/react`,
      undefined,
      ctx.token
    );
    assertEqual(status, 204, 'Status code');
  });
}

// ============ CHAT TESTS ============

async function testChat() {
  console.log('\n--- Chat Tests ---\n');

  await test('Send chat message', async () => {
    const { status, data } = await request(
      'POST',
      '/chat',
      { message: 'Tell me about my family' },
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(data.response, 'Response should be present');
  });

  await test('Send chat with history', async () => {
    const { status, data } = await request(
      'POST',
      '/chat',
      {
        message: 'What did I just ask?',
        history: [
          { role: 'user', content: 'Tell me about grandma' },
          { role: 'assistant', content: 'Your grandmother...' },
        ],
      },
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(data.response, 'Response should be present');
  });

  await test('Extract entities from text', async () => {
    const { status, data } = await request(
      'POST',
      '/chat/extract',
      {
        content: 'Uncle John loves fishing and his birthday is March 15th',
      },
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.extractedMemories), 'Should have extractedMemories');
    assert(Array.isArray(data.extractedEntities), 'Should have extractedEntities');
  });
}

// ============ MEMORY TESTS ============

async function testMemories() {
  console.log('\n--- Memory Tests ---\n');

  await test('Create memory', async () => {
    const { status, data } = await request(
      'POST',
      '/memories',
      {
        fact: 'Test User loves chocolate ice cream',
        aboutId: ctx.userId,
      },
      ctx.token
    );
    assertEqual(status, 201, 'Status code');
    assert(data.id, 'Memory ID should be returned');
    assertEqual(data.confidence, 1.0, 'Manual memories have confidence 1.0');
    ctx.memoryId = data.id;
  });

  await test('List memories', async () => {
    const { status, data } = await request('GET', '/memories', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.memories), 'Memories should be array');
  });

  await test('Filter memories by person', async () => {
    const { status, data } = await request(
      'GET',
      `/memories?about=${ctx.userId}`,
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.memories), 'Memories should be array');
  });

  await test('Filter memories by confidence', async () => {
    const { status, data } = await request(
      'GET',
      '/memories?minConfidence=0.9',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    data.memories.forEach((m: any) => {
      assert(m.confidence >= 0.9, 'All memories should have confidence >= 0.9');
    });
  });
}

// ============ EVENT TESTS ============

async function testEvents() {
  console.log('\n--- Event Tests ---\n');

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const dateStr = futureDate.toISOString().split('T')[0];

  await test('Create event', async () => {
    const { status, data } = await request(
      'POST',
      '/events',
      {
        type: 'birthday',
        title: 'Test Birthday',
        date: dateStr,
        recurring: true,
        involves: [ctx.userId],
      },
      ctx.token
    );
    assertEqual(status, 201, 'Status code');
    assert(data.id, 'Event ID should be returned');
    ctx.eventId = data.id;
  });

  await test('List upcoming events', async () => {
    const { status, data } = await request('GET', '/events', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.events), 'Events should be array');
  });

  await test('Filter events by days', async () => {
    const { status, data } = await request(
      'GET',
      '/events?days=60',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(data.events.length > 0, 'Should have events within 60 days');
  });

  await test('Filter events by type', async () => {
    const { status, data } = await request(
      'GET',
      '/events?type=birthday',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    data.events.forEach((e: any) => {
      assertEqual(e.type, 'birthday', 'All events should be birthdays');
    });
  });

  await test('Event has daysUntil calculated', async () => {
    const { status, data } = await request('GET', '/events', undefined, ctx.token);
    assertEqual(status, 200, 'Status code');
    if (data.events.length > 0) {
      assert(
        typeof data.events[0].daysUntil === 'number',
        'daysUntil should be a number'
      );
    }
  });

  await test('Update event', async () => {
    const { status, data } = await request(
      'PUT',
      `/events/${ctx.eventId}`,
      { title: 'Updated Birthday' },
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assertEqual(data.title, 'Updated Birthday', 'Title should be updated');
  });
}

// ============ SEARCH TESTS ============

async function testSearch() {
  console.log('\n--- Search Tests ---\n');

  // Wait for indexing
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await test('Search all content', async () => {
    const { status, data } = await request(
      'GET',
      '/search?q=grandmother',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    assert(Array.isArray(data.results), 'Results should be array');
  });

  await test('Search stories only', async () => {
    const { status, data } = await request(
      'GET',
      '/search?q=apple&types=stories',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    data.results.forEach((r: any) => {
      assertEqual(r.type, 'story', 'All results should be stories');
    });
  });

  await test('Search memories only', async () => {
    const { status, data } = await request(
      'GET',
      '/search?q=chocolate&types=memories',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    data.results.forEach((r: any) => {
      assertEqual(r.type, 'memory', 'All results should be memories');
    });
  });

  await test('Search with short query fails', async () => {
    const { status } = await request('GET', '/search?q=a', undefined, ctx.token);
    assertEqual(status, 400, 'Status code');
  });

  await test('Search results have relevance score', async () => {
    const { status, data } = await request(
      'GET',
      '/search?q=test',
      undefined,
      ctx.token
    );
    assertEqual(status, 200, 'Status code');
    if (data.results.length > 0) {
      assert(
        typeof data.results[0].relevance === 'number',
        'Relevance should be a number'
      );
    }
  });
}

// ============ CLEANUP TESTS ============

async function testCleanup() {
  console.log('\n--- Cleanup Tests ---\n');

  await test('Delete memory', async () => {
    const { status } = await request(
      'DELETE',
      `/memories/${ctx.memoryId}`,
      undefined,
      ctx.token
    );
    assertEqual(status, 204, 'Status code');
  });

  await test('Delete event', async () => {
    const { status } = await request(
      'DELETE',
      `/events/${ctx.eventId}`,
      undefined,
      ctx.token
    );
    assertEqual(status, 204, 'Status code');
  });

  await test('Delete story', async () => {
    const { status } = await request(
      'DELETE',
      `/stories/${ctx.storyId}`,
      undefined,
      ctx.token
    );
    assertEqual(status, 204, 'Status code');
  });
}

// ============ MAIN ============

async function main() {
  console.log('=================================');
  console.log('  Rememberkin API Tests');
  console.log('=================================');
  console.log(`\nBase URL: ${BASE_URL}\n`);

  try {
    await testAuth();
    await testFamily();
    await testMembers();
    await testStories();
    await testChat();
    await testMemories();
    await testEvents();
    await testSearch();
    await testCleanup();
  } catch (error: any) {
    console.error('\nFatal error:', error.message);
  }

  // Summary
  console.log('\n=================================');
  console.log('  Test Summary');
  console.log('=================================\n');

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
