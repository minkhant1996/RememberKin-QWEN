/**
 * WebSocket Test Suite
 *
 * Tests real-time WebSocket functionality for the Rememberkin.
 * Run with: npx ts-node websocket-tests.ts
 *
 * Prerequisites:
 * - Backend server running on localhost:6100
 * - Valid JWT token (run api-tests.ts first or provide via env)
 */

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:6100/ws';
const API_URL = process.env.API_URL || 'http://localhost:6100/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Get auth token
async function getAuthToken(): Promise<{ token: string; userId: string; familyId: string }> {
  const email = `ws-test-${Date.now()}@example.com`;

  // Register
  const regResponse = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'testpassword123',
      name: 'WS Test User',
    }),
  });
  const regData = await regResponse.json();

  // Create family
  const famResponse = await fetch(`${API_URL}/family`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData.token}`,
    },
    body: JSON.stringify({ name: 'WS Test Family' }),
  });
  const famData = await famResponse.json();

  return {
    token: regData.token,
    userId: regData.user.id,
    familyId: famData.id,
  };
}

// Helper: Create WebSocket connection
function createConnection(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

// Helper: Wait for message
function waitForMessage(
  ws: WebSocket,
  type: string,
  timeout = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message: ${type}`));
    }, timeout);

    const handler = (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === type) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(message);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    ws.on('message', handler);
  });
}

// Helper: Run test
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

// ============ CONNECTION TESTS ============

async function testConnection(token: string) {
  console.log('\n--- Connection Tests ---\n');

  await test('Connect with valid token', async () => {
    const ws = await createConnection(token);
    assert(ws.readyState === WebSocket.OPEN, 'Should be connected');
    ws.close();
  });

  await test('Connect without token fails', async () => {
    try {
      const ws = new WebSocket(WS_URL);
      await new Promise<void>((resolve, reject) => {
        ws.on('close', (code) => {
          if (code === 4001) {
            resolve();
          } else {
            reject(new Error(`Unexpected close code: ${code}`));
          }
        });
        ws.on('error', () => resolve()); // Connection refused is expected
        setTimeout(() => reject(new Error('Should have been rejected')), 3000);
      });
    } catch (e: any) {
      if (!e.message.includes('Should have been rejected')) {
        // Connection was properly rejected
        return;
      }
      throw e;
    }
  });

  await test('Connect with invalid token fails', async () => {
    try {
      const ws = new WebSocket(`${WS_URL}?token=invalid-token`);
      await new Promise<void>((resolve, reject) => {
        ws.on('close', (code) => {
          if (code === 4001) {
            resolve();
          } else {
            reject(new Error(`Unexpected close code: ${code}`));
          }
        });
        ws.on('error', () => resolve());
        setTimeout(() => reject(new Error('Should have been rejected')), 3000);
      });
    } catch (e: any) {
      if (!e.message.includes('Should have been rejected')) {
        return;
      }
      throw e;
    }
  });
}

// ============ ROOM TESTS ============

async function testRooms(token: string, familyId: string) {
  console.log('\n--- Room Tests ---\n');

  await test('Join family room', async () => {
    const ws = await createConnection(token);

    // Join room
    ws.send(JSON.stringify({ type: 'join', familyId }));

    // Give it time to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Connection should still be open
    assert(ws.readyState === WebSocket.OPEN, 'Should still be connected');

    ws.close();
  });
}

// ============ PRESENCE TESTS ============

async function testPresence(
  token1: string,
  token2: string,
  familyId: string,
  userId1: string
) {
  console.log('\n--- Presence Tests ---\n');

  await test('Receive member:online when user joins', async () => {
    // User 1 connects and joins
    const ws1 = await createConnection(token1);
    ws1.send(JSON.stringify({ type: 'join', familyId }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    // User 2 connects and joins, should trigger member:online
    const messagePromise = waitForMessage(ws1, 'member:online', 3000);
    const ws2 = await createConnection(token2);
    ws2.send(JSON.stringify({ type: 'join', familyId }));

    try {
      const message = await messagePromise;
      assert(message.memberId, 'Should have memberId');
    } finally {
      ws1.close();
      ws2.close();
    }
  });

  await test('Receive member:offline when user leaves', async () => {
    // Both users connect
    const ws1 = await createConnection(token1);
    ws1.send(JSON.stringify({ type: 'join', familyId }));

    const ws2 = await createConnection(token2);
    ws2.send(JSON.stringify({ type: 'join', familyId }));

    await new Promise((resolve) => setTimeout(resolve, 500));

    // User 1 listens for offline
    const messagePromise = waitForMessage(ws1, 'member:offline', 3000);

    // User 2 disconnects
    ws2.close();

    try {
      const message = await messagePromise;
      assert(message.memberId, 'Should have memberId');
    } finally {
      ws1.close();
    }
  });

  await test('Send and receive presence update', async () => {
    const ws1 = await createConnection(token1);
    ws1.send(JSON.stringify({ type: 'join', familyId }));

    const ws2 = await createConnection(token2);
    ws2.send(JSON.stringify({ type: 'join', familyId }));

    await new Promise((resolve) => setTimeout(resolve, 500));

    // User 1 listens for presence
    const messagePromise = waitForMessage(ws1, 'member:presence', 3000);

    // User 2 sends presence
    ws2.send(JSON.stringify({ type: 'presence', status: 'away' }));

    try {
      const message = await messagePromise;
      assert(message.status === 'away', 'Status should be away');
    } finally {
      ws1.close();
      ws2.close();
    }
  });
}

// ============ TYPING TESTS ============

async function testTyping(
  token1: string,
  token2: string,
  familyId: string
) {
  console.log('\n--- Typing Tests ---\n');

  await test('Send and receive typing indicator', async () => {
    const ws1 = await createConnection(token1);
    ws1.send(JSON.stringify({ type: 'join', familyId }));

    const ws2 = await createConnection(token2);
    ws2.send(JSON.stringify({ type: 'join', familyId }));

    await new Promise((resolve) => setTimeout(resolve, 500));

    // User 1 listens for typing
    const messagePromise = waitForMessage(ws1, 'member:typing', 3000);

    // User 2 sends typing
    ws2.send(JSON.stringify({ type: 'typing', storyId: 'story-123' }));

    try {
      const message = await messagePromise;
      assert(message.storyId === 'story-123', 'Should have storyId');
      assert(message.memberId, 'Should have memberId');
    } finally {
      ws1.close();
      ws2.close();
    }
  });
}

// ============ HEARTBEAT TESTS ============

async function testHeartbeat(token: string) {
  console.log('\n--- Heartbeat Tests ---\n');

  await test('Connection responds to ping', async () => {
    const ws = await createConnection(token);

    await new Promise<void>((resolve, reject) => {
      ws.on('pong', () => resolve());
      ws.ping();
      setTimeout(() => reject(new Error('No pong received')), 3000);
    });

    ws.close();
  });
}

// ============ MAIN ============

async function main() {
  console.log('=====================================');
  console.log('  Rememberkin WebSocket Tests');
  console.log('=====================================');
  console.log(`\nWebSocket URL: ${WS_URL}\n`);

  let auth1: { token: string; userId: string; familyId: string };
  let auth2: { token: string; userId: string; familyId: string };

  try {
    console.log('Setting up test users...');
    auth1 = await getAuthToken();
    console.log(`User 1 created: ${auth1.userId}`);

    // Create second user and add to same family
    const email2 = `ws-test2-${Date.now()}@example.com`;
    const reg2 = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email2,
        password: 'testpassword123',
        name: 'WS Test User 2',
      }),
    });
    const regData2 = await reg2.json();

    // Invite second user to first user's family
    await fetch(`${API_URL}/family/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth1.token}`,
      },
      body: JSON.stringify({ email: email2 }),
    });

    auth2 = {
      token: regData2.token,
      userId: regData2.user.id,
      familyId: auth1.familyId,
    };
    console.log(`User 2 created: ${auth2.userId}\n`);
  } catch (error: any) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }

  try {
    await testConnection(auth1.token);
    await testRooms(auth1.token, auth1.familyId);
    await testPresence(auth1.token, auth2.token, auth1.familyId, auth1.userId);
    await testTyping(auth1.token, auth2.token, auth1.familyId);
    await testHeartbeat(auth1.token);
  } catch (error: any) {
    console.error('\nFatal error:', error.message);
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
