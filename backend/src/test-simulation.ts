/**
 * Test Simulation Service
 */

import { simulationService } from './services/simulation.service.js';

async function testSimulation() {
  console.log('═'.repeat(60));
  console.log('    REMEMBERKIN - FAMILY SIMULATION TEST');
  console.log('═'.repeat(60));
  console.log();

  // Test 1: Get personas
  console.log('1. Test User Personas:');
  const personas = simulationService.getPersonas();

  console.log('\n   👨‍👩‍👧 FAMILY:');
  personas.forEach(p => {
    console.log(`      - ${p.name}: ${p.description.slice(0, 45)}...`);
  });
  console.log();

  // Test 2: Get scenarios
  console.log('2. Available Scenarios:');
  const scenarios = simulationService.getScenarios();

  console.log('\n   👨‍👩‍👧 FAMILY:');
  scenarios.forEach(s => {
    console.log(`      - ${s.name} (${s.conversationTurns} turns)`);
  });
  console.log();

  // Test 3: Run a single scenario
  console.log('3. Running Family Memory Recall Test scenario...');
  console.log();

  const scenario = scenarios[0]; // Family Memory Recall

  const result = await simulationService.runScenario(
    scenario,
    (turn, result) => {
      const prefix = turn.role === 'user' ? '👤 User' : '🤖 Agent';
      console.log(`   ${prefix}: ${turn.content.slice(0, 80)}...`);
      if (turn.latencyMs) {
        console.log(`      (${turn.latencyMs}ms, ${turn.tokensUsed} tokens)`);
      }
    }
  );

  console.log();
  console.log('4. Results:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Turns: ${result.conversation.length}`);
  console.log(`   Total Latency: ${(result.totalLatencyMs / 1000).toFixed(2)}s`);
  console.log(`   Total Tokens: ${result.totalTokens}`);
  console.log(`   Total Cost: $${result.totalCost.toFixed(4)}`);

  if (result.scores) {
    console.log();
    console.log('5. Scores:');
    console.log(`   Memory Recall: ${result.scores.memoryRecall}`);
    console.log(`   Context Relevance: ${result.scores.contextRelevance}`);
    console.log(`   Entity Extraction: ${result.scores.entityExtraction}`);
    console.log(`   Emotional Tone: ${result.scores.emotionalTone}`);
    const avg = (
      result.scores.memoryRecall +
      result.scores.contextRelevance +
      result.scores.entityExtraction +
      result.scores.emotionalTone
    ) / 4;
    console.log(`   Average: ${avg.toFixed(1)}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Test complete!');
}

testSimulation().catch(console.error);
