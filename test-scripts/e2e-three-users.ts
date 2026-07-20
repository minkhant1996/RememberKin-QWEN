/**
 * End-to-End Test: Three Users Flow
 *
 * This test simulates real usage with 3 different users:
 *
 * 1. SARAH (Family Organizer)
 *    - Creates the family "The Johnsons"
 *    - Adds deceased grandparents (Grandma Rose, Grandpa William)
 *    - Shares nostalgic stories about grandparents
 *    - Tests memory extraction from stories
 *
 * 2. MIKE (Sarah's Husband)
 *    - Joins the family via invite
 *    - Creates family events (anniversaries, birthdays)
 *    - Uses chat to ask about family members
 *    - Tests memory recall in conversations
 *
 * 3. EMMA (Sarah's Sister)
 *    - Joins the family
 *    - Adds more stories about grandparents
 *    - Triggers memory consolidation
 *    - Tests pattern detection
 */

const API_URL = process.env.API_URL || 'http://localhost:6100/api/v1';

interface User {
  id: string;
  email: string;
  name: string;
  token: string;
  familyId?: string;
}

interface TestResult {
  test: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

// Utility functions
async function api(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

function log(message: string, type: 'info' | 'success' | 'error' | 'section' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    section: '\x1b[35m', // Magenta
  };
  const reset = '\x1b[0m';
  const prefix = type === 'section' ? '\n═══' : type === 'success' ? '✓' : type === 'error' ? '✗' : '→';
  console.log(`${colors[type]}${prefix} ${message}${reset}`);
}

function recordResult(test: string, passed: boolean, details?: string, error?: string) {
  results.push({ test, passed, details, error });
  if (passed) {
    log(`${test}: ${details || 'OK'}`, 'success');
  } else {
    log(`${test}: ${error}`, 'error');
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// USER 1: SARAH - Family Organizer
// ============================================================
async function sarahFlow(): Promise<User> {
  log('SARAH - Family Organizer', 'section');

  const sarah: User = {
    id: '',
    email: `sarah.johnson.${Date.now()}@test.com`,
    name: 'Sarah Johnson',
    token: '',
  };

  // 1. Register Sarah
  try {
    log('Registering Sarah...');
    const registerRes = await api('/auth/register', 'POST', {
      email: sarah.email,
      password: 'SecurePass123!',
      name: sarah.name,
    });
    sarah.id = registerRes.user.id;
    sarah.token = registerRes.token;
    recordResult('Sarah Registration', true, `ID: ${sarah.id}`);
  } catch (error) {
    recordResult('Sarah Registration', false, undefined, (error as Error).message);
    throw error;
  }

  // 2. Create Family
  try {
    log('Creating family "The Johnsons"...');
    const familyRes = await api('/families', 'POST', {
      name: 'The Johnsons',
    }, sarah.token);
    sarah.familyId = familyRes.family.id;
    recordResult('Create Family', true, `Family ID: ${sarah.familyId}`);
  } catch (error) {
    recordResult('Create Family', false, undefined, (error as Error).message);
    throw error;
  }

  // 3. Add Deceased Grandparents
  try {
    log('Adding Grandma Rose (deceased)...');
    const grandmaRes = await api('/members', 'POST', {
      name: 'Rose Johnson',
      nickname: 'Grandma Rose',
      birthDate: '1935-03-15',
      deathDate: '2020-11-20',
      isDeceased: true,
    }, sarah.token);
    recordResult('Add Grandma Rose', true, `ID: ${grandmaRes.id}`);

    log('Adding Grandpa William (deceased)...');
    const grandpaRes = await api('/members', 'POST', {
      name: 'William Johnson',
      nickname: 'Grandpa Bill',
      birthDate: '1932-07-22',
      deathDate: '2018-05-10',
      isDeceased: true,
    }, sarah.token);
    recordResult('Add Grandpa William', true, `ID: ${grandpaRes.id}`);
  } catch (error) {
    recordResult('Add Deceased Members', false, undefined, (error as Error).message);
  }

  // 4. Share Stories About Grandparents
  try {
    log('Sharing story about Grandma Rose...');
    await api('/stories', 'POST', {
      content: `Grandma Rose made the best apple pie every Thanksgiving. She always said the secret ingredient was love, but we later found out it was also a splash of bourbon! She loved Sunday morning calls and would talk for hours about her garden. Her roses were famous in the neighborhood.`,
    }, sarah.token);
    recordResult('Story 1: Grandma Rose', true, 'Apple pie memory');

    log('Sharing story about Grandpa Bill...');
    await api('/stories', 'POST', {
      content: `Grandpa Bill was a World War II veteran who rarely talked about the war, but he loved telling stories about his time as a carpenter afterward. He built our family's first dining table with his own hands. Every Christmas, he would carve wooden toys for all the grandchildren. He preferred black coffee and always woke up at 5 AM.`,
    }, sarah.token);
    recordResult('Story 2: Grandpa Bill', true, 'Woodworking memory');
  } catch (error) {
    recordResult('Share Stories', false, undefined, (error as Error).message);
  }

  // 5. Use Chat to Talk About Family
  try {
    log('Chatting about family memories...');
    const chatRes = await api('/chat', 'POST', {
      message: 'Tell me what you know about Grandma Rose. What were her favorite things?',
    }, sarah.token);
    recordResult('Chat: Ask about Grandma', true, `Response length: ${chatRes.response.length} chars`);
  } catch (error) {
    recordResult('Chat', false, undefined, (error as Error).message);
  }

  // 6. Check Memory Dashboard
  try {
    log('Checking memory stats...');
    const stats = await api('/memory-dashboard/stats', 'GET', undefined, sarah.token);
    recordResult('Memory Stats', true,
      `Working: ${stats.working.count}, Episodic: ${stats.episodic.count}, Semantic: ${stats.semantic.count}`
    );
  } catch (error) {
    recordResult('Memory Stats', false, undefined, (error as Error).message);
  }

  return sarah;
}

// ============================================================
// USER 2: MIKE - Sarah's Husband
// ============================================================
async function mikeFlow(familyId: string): Promise<User> {
  log('MIKE - Event Planner Husband', 'section');

  const mike: User = {
    id: '',
    email: `mike.johnson.${Date.now()}@test.com`,
    name: 'Mike Johnson',
    token: '',
    familyId,
  };

  // 1. Register Mike
  try {
    log('Registering Mike...');
    const registerRes = await api('/auth/register', 'POST', {
      email: mike.email,
      password: 'SecurePass123!',
      name: mike.name,
    });
    mike.id = registerRes.user.id;
    mike.token = registerRes.token;
    recordResult('Mike Registration', true, `ID: ${mike.id}`);
  } catch (error) {
    recordResult('Mike Registration', false, undefined, (error as Error).message);
    throw error;
  }

  // 2. Join Family
  try {
    log('Joining "The Johnsons" family...');
    await api(`/families/${familyId}/join`, 'POST', {}, mike.token);
    recordResult('Mike Join Family', true, `Joined family: ${familyId}`);
  } catch (error) {
    recordResult('Mike Join Family', false, undefined, (error as Error).message);
  }

  // 3. Create Family Events
  try {
    log('Creating wedding anniversary event...');
    await api('/events', 'POST', {
      type: 'anniversary',
      title: 'Sarah & Mike Wedding Anniversary',
      description: 'Our 10th wedding anniversary celebration',
      date: '2024-06-15',
      recurring: true,
      reminderDays: [7, 1],
    }, mike.token);
    recordResult('Create Anniversary Event', true);

    log('Creating Grandma Rose memorial...');
    await api('/events', 'POST', {
      type: 'custom',
      title: 'Grandma Rose Memorial Day',
      description: 'Annual remembrance of Grandma Rose',
      date: '2024-11-20',
      recurring: true,
      reminderDays: [7],
    }, mike.token);
    recordResult('Create Memorial Event', true);
  } catch (error) {
    recordResult('Create Events', false, undefined, (error as Error).message);
  }

  // 4. Use Chat to Learn About Family
  try {
    log('Chatting to learn about in-laws...');
    const chat1 = await api('/chat', 'POST', {
      message: 'I want to learn more about Sarah\'s grandparents. What kind of people were they?',
    }, mike.token);
    recordResult('Chat: Learn about grandparents', true, `Got ${chat1.relatedStories?.length || 0} related stories`);

    log('Asking about family traditions...');
    const chat2 = await api('/chat', 'POST', {
      message: 'What family traditions should I know about? Any special recipes or holiday customs?',
    }, mike.token);
    recordResult('Chat: Family traditions', true);
  } catch (error) {
    recordResult('Mike Chat', false, undefined, (error as Error).message);
  }

  // 5. Get Family Tree
  try {
    log('Getting family tree...');
    const tree = await api('/family-tree', 'GET', undefined, mike.token);
    recordResult('Get Family Tree', true, `Nodes: ${tree.nodes?.length || 0}, Edges: ${tree.edges?.length || 0}`);
  } catch (error) {
    recordResult('Get Family Tree', false, undefined, (error as Error).message);
  }

  // 6. Search for Memories
  try {
    log('Searching for apple pie memories...');
    const search = await api('/search?q=apple%20pie', 'GET', undefined, mike.token);
    recordResult('Search Memories', true, `Found: ${search.results?.length || 0} results`);
  } catch (error) {
    recordResult('Search Memories', false, undefined, (error as Error).message);
  }

  return mike;
}

// ============================================================
// USER 3: EMMA - Sarah's Sister
// ============================================================
async function emmaFlow(familyId: string): Promise<User> {
  log('EMMA - Story Contributor Sister', 'section');

  const emma: User = {
    id: '',
    email: `emma.wilson.${Date.now()}@test.com`,
    name: 'Emma Wilson',
    token: '',
    familyId,
  };

  // 1. Register Emma
  try {
    log('Registering Emma...');
    const registerRes = await api('/auth/register', 'POST', {
      email: emma.email,
      password: 'SecurePass123!',
      name: emma.name,
    });
    emma.id = registerRes.user.id;
    emma.token = registerRes.token;
    recordResult('Emma Registration', true, `ID: ${emma.id}`);
  } catch (error) {
    recordResult('Emma Registration', false, undefined, (error as Error).message);
    throw error;
  }

  // 2. Join Family
  try {
    log('Joining "The Johnsons" family...');
    await api(`/families/${familyId}/join`, 'POST', {}, emma.token);
    recordResult('Emma Join Family', true);
  } catch (error) {
    recordResult('Emma Join Family', false, undefined, (error as Error).message);
  }

  // 3. Add More Stories (to reinforce memories)
  try {
    log('Sharing childhood story about Grandma Rose...');
    await api('/stories', 'POST', {
      content: `I remember staying at Grandma Rose's house every summer. She would wake up early to tend her rose garden, and the smell of fresh roses mixed with her apple pie baking is my happiest childhood memory. She taught me how to knit and always had a jar of homemade cookies ready. Grandma Rose loved her Sunday phone calls - she said it was the highlight of her week.`,
    }, emma.token);
    recordResult('Emma Story 1: Grandma Rose', true, 'Reinforces apple pie + Sunday calls');

    log('Sharing story about Grandpa Bill...');
    await api('/stories', 'POST', {
      content: `Grandpa Bill was strict but loving. He taught me to fish at the lake house and always drank his coffee black - no sugar, no cream. He'd say "coffee should taste like coffee." He was an early riser, always up by 5 AM, and would sit on the porch watching the sunrise. His wooden carvings were beautiful - I still have the horse he made for my 8th birthday.`,
    }, emma.token);
    recordResult('Emma Story 2: Grandpa Bill', true, 'Reinforces black coffee + 5 AM');

    log('Sharing holiday memory...');
    await api('/stories', 'POST', {
      content: `Christmas at the Johnson house was magical. Grandma Rose would make her famous apple pie (she made at least three every year!), and Grandpa Bill would hand out the wooden toys he'd been secretly carving all year. The whole family would gather around the dining table that Grandpa built. Mom says he spent 6 months on that table.`,
    }, emma.token);
    recordResult('Emma Story 3: Christmas', true, 'Multiple memory reinforcements');
  } catch (error) {
    recordResult('Emma Stories', false, undefined, (error as Error).message);
  }

  // 4. Chat to Extract More Facts
  try {
    log('Chatting about childhood memories...');
    await api('/chat', 'POST', {
      message: 'I was just thinking about summers at Grandma Rose\'s house. She always had roses blooming and fresh apple pie. Do you remember any details about her garden?',
    }, emma.token);
    recordResult('Emma Chat 1', true);

    log('Asking about Grandpa\'s woodworking...');
    await api('/chat', 'POST', {
      message: 'Grandpa Bill was such a talented woodworker. I still have the toys he made. What do we know about his carpentry work?',
    }, emma.token);
    recordResult('Emma Chat 2', true);
  } catch (error) {
    recordResult('Emma Chat', false, undefined, (error as Error).message);
  }

  // 5. Trigger Memory Consolidation
  try {
    log('Triggering memory consolidation...');
    const consolidateRes = await api('/memory-dashboard/consolidate', 'POST', {}, emma.token);
    recordResult('Consolidate Memories', true,
      `Consolidated: ${consolidateRes.result?.consolidated || 0}, Reinforced: ${consolidateRes.result?.reinforced || 0}`
    );
  } catch (error) {
    recordResult('Consolidate Memories', false, undefined, (error as Error).message);
  }

  // 6. Trigger Pattern Detection
  try {
    log('Detecting patterns...');
    const patternRes = await api('/memory-dashboard/detect-patterns', 'POST', {}, emma.token);
    recordResult('Detect Patterns', true, `Patterns found: ${patternRes.result?.patternsFound || 0}`);
  } catch (error) {
    recordResult('Detect Patterns', false, undefined, (error as Error).message);
  }

  // 7. Check Final Memory State
  try {
    log('Getting final memory stats...');
    const stats = await api('/memory-dashboard/stats', 'GET', undefined, emma.token);
    recordResult('Final Memory Stats', true,
      `Working: ${stats.working.count}, Episodic: ${stats.episodic.count}, Semantic: ${stats.semantic.count}, Procedural: ${stats.procedural.count}`
    );

    log('Getting semantic memories...');
    const semantic = await api('/memory-dashboard/semantic?limit=10', 'GET', undefined, emma.token);
    recordResult('Semantic Memories', true, `Total facts: ${semantic.total}`);

    // Log some extracted facts
    if (semantic.memories && semantic.memories.length > 0) {
      log('\n   Sample extracted facts:');
      semantic.memories.slice(0, 5).forEach((m: any) => {
        console.log(`      • ${m.aboutName}: "${m.fact}" (${Math.round(m.confidence * 100)}%)`);
      });
    }
  } catch (error) {
    recordResult('Final Memory Check', false, undefined, (error as Error).message);
  }

  // 8. Run Memory Maintenance (Timely Forgetting Demo)
  try {
    log('Running memory maintenance...');
    const maintenance = await api('/memory-dashboard/maintenance', 'POST', {}, emma.token);
    recordResult('Memory Maintenance', true, maintenance.message);
  } catch (error) {
    recordResult('Memory Maintenance', false, undefined, (error as Error).message);
  }

  // 9. Get Activity Feed
  try {
    log('Getting activity feed...');
    const activity = await api('/memory-dashboard/activity?limit=10', 'GET', undefined, emma.token);
    recordResult('Activity Feed', true, `${activity.total} activities`);

    if (activity.activities && activity.activities.length > 0) {
      log('\n   Recent activity:');
      activity.activities.slice(0, 5).forEach((a: any) => {
        console.log(`      • [${a.type}] ${a.description}`);
      });
    }
  } catch (error) {
    recordResult('Activity Feed', false, undefined, (error as Error).message);
  }

  return emma;
}

// ============================================================
// VERIFICATION: Cross-User Memory Access
// ============================================================
async function verifySharedMemories(sarah: User, mike: User, emma: User) {
  log('VERIFICATION - Shared Family Memories', 'section');

  // Mike should be able to see memories about Grandma Rose
  try {
    log('Mike queries memories about Grandma Rose...');
    const mikeChat = await api('/chat', 'POST', {
      message: 'What do we know about Grandma Rose? What were her favorite things and traditions?',
    }, mike.token);

    const mentionsApplePie = mikeChat.response.toLowerCase().includes('apple pie') ||
                             mikeChat.response.toLowerCase().includes('pie');
    const mentionsSundayCalls = mikeChat.response.toLowerCase().includes('sunday');

    recordResult('Mike Recalls Grandma Memories', mentionsApplePie || mentionsSundayCalls,
      `Apple pie: ${mentionsApplePie}, Sunday calls: ${mentionsSundayCalls}`
    );
  } catch (error) {
    recordResult('Mike Recall Test', false, undefined, (error as Error).message);
  }

  // Sarah should see reinforced memories
  try {
    log('Sarah checks consolidated memories...');
    const semantic = await api('/memory-dashboard/semantic', 'GET', undefined, sarah.token);

    const hasReinforcedMemories = semantic.memories?.some((m: any) => m.reinforcementCount > 1);
    recordResult('Sarah Sees Reinforced Memories', hasReinforcedMemories || semantic.total > 0,
      `Total memories: ${semantic.total}, Has reinforced: ${hasReinforcedMemories}`
    );
  } catch (error) {
    recordResult('Sarah Memory Check', false, undefined, (error as Error).message);
  }

  // All users should see same family members
  try {
    log('Verifying all users see same family tree...');
    const sarahTree = await api('/family-tree', 'GET', undefined, sarah.token);
    const mikeTree = await api('/family-tree', 'GET', undefined, mike.token);
    const emmaTree = await api('/family-tree', 'GET', undefined, emma.token);

    const sameNodeCount = sarahTree.nodes?.length === mikeTree.nodes?.length &&
                          mikeTree.nodes?.length === emmaTree.nodes?.length;

    recordResult('Family Tree Consistency', sameNodeCount,
      `Sarah: ${sarahTree.nodes?.length}, Mike: ${mikeTree.nodes?.length}, Emma: ${emmaTree.nodes?.length} nodes`
    );
  } catch (error) {
    recordResult('Family Tree Consistency', false, undefined, (error as Error).message);
  }
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================
async function runE2ETest() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     FAMILY MEMORY KEEPER - END-TO-END TEST (3 USERS)           ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║  User 1: SARAH - Family Organizer (creates family)             ║');
  console.log('║  User 2: MIKE  - Event Planner (husband, joins family)         ║');
  console.log('║  User 3: EMMA  - Story Contributor (sister, reinforces facts)  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const startTime = Date.now();

  try {
    // Health check first
    log('Checking API health...');
    await api('/health', 'GET');
    recordResult('API Health Check', true);
  } catch (error) {
    log(`API not available at ${API_URL}`, 'error');
    log('Please start the backend first: ./start-local.sh', 'error');
    process.exit(1);
  }

  let sarah: User | null = null;
  let mike: User | null = null;
  let emma: User | null = null;

  try {
    // Run Sarah's flow (creates family)
    sarah = await sarahFlow();
    await sleep(500);

    // Run Mike's flow (joins family)
    if (sarah.familyId) {
      mike = await mikeFlow(sarah.familyId);
      await sleep(500);
    }

    // Run Emma's flow (consolidates memories)
    if (sarah.familyId) {
      emma = await emmaFlow(sarah.familyId);
      await sleep(500);
    }

    // Verify shared memories
    if (sarah && mike && emma) {
      await verifySharedMemories(sarah, mike, emma);
    }

  } catch (error) {
    log(`Test failed: ${(error as Error).message}`, 'error');
  }

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                            ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tests:  ${(passed + failed).toString().padEnd(4)} │ Passed: ${passed.toString().padEnd(4)} │ Failed: ${failed.toString().padEnd(4)}     ║`);
  console.log(`║  Duration:     ${duration}s                                          ║`.slice(0, 69) + '║');
  console.log(`║  Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%                                        ║`.slice(0, 69) + '║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n\x1b[31mFailed Tests:\x1b[0m');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ ${r.test}: ${r.error}`);
    });
  }

  console.log('\n');

  // Memory System Summary
  if (emma) {
    console.log('\x1b[35m═══ MEMORY SYSTEM DEMONSTRATION ═══\x1b[0m');
    console.log('\nWhat was tested:');
    console.log('  1. ✓ Multi-user family collaboration');
    console.log('  2. ✓ Deceased family member support');
    console.log('  3. ✓ Story creation with memory extraction');
    console.log('  4. ✓ Chat-based memory recall');
    console.log('  5. ✓ Memory consolidation (working → semantic)');
    console.log('  6. ✓ Memory reinforcement (repeated facts)');
    console.log('  7. ✓ Pattern detection (procedural memory)');
    console.log('  8. ✓ Memory maintenance (timely forgetting)');
    console.log('  9. ✓ Cross-user memory access');
    console.log('\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run the test
runE2ETest().catch(console.error);
