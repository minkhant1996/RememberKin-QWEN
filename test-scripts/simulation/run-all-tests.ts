/**
 * Run All Simulation Tests
 *
 * Executes family test scenarios and displays end-to-end results
 * with value demonstration.
 */

const API_BASE = process.env.API_URL || 'http://localhost:6100/api/v1';

interface TestResult {
  scenario: string;
  type: 'family';
  status: 'passed' | 'failed';
  scores: {
    memoryRecall: number;
    contextRelevance: number;
    entityExtraction: number;
    emotionalTone: number;
    average: number;
  };
  extracted: {
    people: string[];
    events: string[];
    facts: string[];
  };
  value: {
    memoriesPreserved: number;
    connectionsTracked: number;
    datesRemembered: number;
  };
  latencyMs: number;
  cost: number;
}

async function runAllTests(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('        REMEMBERKIN - END-TO-END SIMULATION TESTS');
  console.log('═'.repeat(70));
  console.log();

  // Connect to SSE for live updates
  console.log('📡 Connecting to simulation server...');

  try {
    // Start all simulations
    const response = await fetch(`${API_BASE}/simulation/run`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to start simulation: ${response.statusText}`);
    }

    console.log('✅ Simulation started! Watching for results...\n');

    // Poll for results
    await watchResults();

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function watchResults(): Promise<void> {
  const startTime = Date.now();
  const maxWait = 5 * 60 * 1000; // 5 minutes max

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(`${API_BASE}/simulation/state`);
    const { data: state } = await response.json();

    if (!state.isRunning && state.results.length > 0) {
      // Simulation complete
      displayResults(state.results);
      return;
    }

    // Still running, show progress
    process.stdout.write(`\r⏳ Running... ${state.results.length} scenarios complete`);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n⚠️ Timeout waiting for results');
}

function displayResults(results: any[]): void {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('                         TEST RESULTS');
  console.log('═'.repeat(70));
  console.log();

  // Display Family results
  console.log('👨‍👩‍👧 FAMILY TESTS');
  console.log('─'.repeat(70));
  displayTypeResults(results);

  // Summary
  displaySummary(results);
}

function displayTypeResults(results: any[]): void {
  for (const result of results) {
    const status = result.status === 'completed' ? '✅' : '❌';
    const scores = result.scores;
    const avg = scores
      ? ((scores.memoryRecall + scores.contextRelevance + scores.entityExtraction + scores.emotionalTone) / 4).toFixed(1)
      : 'N/A';

    console.log(`${status} ${result.scenarioName}`);
    console.log(`   Score: ${avg}/100 | Latency: ${(result.totalLatencyMs/1000).toFixed(2)}s | Cost: $${result.totalCost.toFixed(4)}`);

    if (scores) {
      console.log(`   📊 Memory: ${scores.memoryRecall} | Context: ${scores.contextRelevance} | Entity: ${scores.entityExtraction} | Tone: ${scores.emotionalTone}`);
    }
    console.log();
  }
}

function displaySummary(results: any[]): void {
  console.log('═'.repeat(70));
  console.log('                          SUMMARY');
  console.log('═'.repeat(70));
  console.log();

  const completed = results.filter(r => r.status === 'completed');
  const failed = results.filter(r => r.status === 'failed');

  const allScores = completed
    .filter(r => r.scores)
    .map(r => (r.scores.memoryRecall + r.scores.contextRelevance + r.scores.entityExtraction + r.scores.emotionalTone) / 4);

  const avgScore = allScores.length > 0
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : 'N/A';

  const totalLatency = results.reduce((sum, r) => sum + r.totalLatencyMs, 0);
  const totalCost = results.reduce((sum, r) => sum + r.totalCost, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

  console.log(`📊 Total Scenarios:    ${results.length}`);
  console.log(`✅ Passed:             ${completed.length}`);
  console.log(`❌ Failed:             ${failed.length}`);
  console.log(`📈 Average Score:      ${avgScore}/100`);
  console.log(`⏱️  Total Latency:      ${(totalLatency/1000).toFixed(2)}s`);
  console.log(`🔤 Total Tokens:       ${totalTokens.toLocaleString()}`);
  console.log(`💰 Total Cost:         $${totalCost.toFixed(4)}`);
  console.log();

  // Value demonstration
  console.log('═'.repeat(70));
  console.log('                      VALUE DELIVERED');
  console.log('═'.repeat(70));
  console.log();
  console.log('✨ Family Memory Preservation:');
  console.log('   • Family stories preserved for generations');
  console.log('   • Birthdays and events never forgotten');
  console.log('   • Traditions and recipes documented');
  console.log('   • Family connections tracked');
  console.log('   • Legacy maintained for future generations');
  console.log();
  console.log('═'.repeat(70));
  console.log('                    TEST RUN COMPLETE');
  console.log('═'.repeat(70));
}

// Run tests
runAllTests();
