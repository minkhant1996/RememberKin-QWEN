/**
 * Test Qwen Cloud API Free Trial
 *
 * Tests all models we're using to verify free quota access.
 * Run: npx ts-node test-scripts/test-qwen-api.ts
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_BASE_URL = process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

if (!QWEN_API_KEY) {
  console.error('❌ QWEN_API_KEY not found in backend/.env');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: QWEN_API_KEY,
  baseURL: QWEN_BASE_URL,
});

// Models to test
const MODELS_TO_TEST = [
  { id: 'qwen-max', type: 'chat', description: 'Main chat model' },
  { id: 'qwq-plus', type: 'chat', description: 'Reasoning model' },
  { id: 'qwen-flash', type: 'chat', description: 'Fast model' },
  { id: 'qwen-turbo', type: 'chat', description: 'Turbo model' },
  { id: 'text-embedding-v3', type: 'embedding', description: 'Embedding model' },
];

interface TestResult {
  model: string;
  success: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

async function testChatModel(modelId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply briefly.' },
        { role: 'user', content: 'Say "Hello from Qwen!" in exactly 5 words.' },
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content || '';

    console.log(`  Response: "${content}"`);

    return {
      model: modelId,
      success: true,
      latencyMs,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };
  } catch (error: any) {
    return {
      model: modelId,
      success: false,
      latencyMs: Date.now() - start,
      error: error.message || String(error),
    };
  }
}

async function testEmbeddingModel(modelId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await client.embeddings.create({
      model: modelId,
      input: 'Family memories are precious.',
    });

    const latencyMs = Date.now() - start;
    const embedding = response.data[0]?.embedding;

    console.log(`  Embedding dimensions: ${embedding?.length || 0}`);

    return {
      model: modelId,
      success: true,
      latencyMs,
      inputTokens: (response as any).usage?.prompt_tokens || 5,
      outputTokens: 0,
    };
  } catch (error: any) {
    return {
      model: modelId,
      success: false,
      latencyMs: Date.now() - start,
      error: error.message || String(error),
    };
  }
}

async function testJsonMode(): Promise<TestResult> {
  const modelId = 'qwen-flash';
  const start = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: 'Extract entities. Return JSON: {"people": ["name"], "facts": ["fact"]}'
        },
        {
          role: 'user',
          content: 'Grandma Rose loves apple pie and lives in Boston.'
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3,
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content || '';

    // Try to parse JSON
    const parsed = JSON.parse(content);
    console.log(`  JSON Response:`, JSON.stringify(parsed, null, 2));

    return {
      model: `${modelId} (JSON mode)`,
      success: true,
      latencyMs,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };
  } catch (error: any) {
    return {
      model: `${modelId} (JSON mode)`,
      success: false,
      latencyMs: Date.now() - start,
      error: error.message || String(error),
    };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    QWEN CLOUD API TEST                         ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`API Key: ${QWEN_API_KEY?.slice(0, 15)}...${QWEN_API_KEY?.slice(-10)}`);
  console.log(`Base URL: ${QWEN_BASE_URL}`);
  console.log();

  const results: TestResult[] = [];

  // Test each model
  for (const model of MODELS_TO_TEST) {
    console.log(`\n🧪 Testing: ${model.id} (${model.description})`);
    console.log('─'.repeat(50));

    let result: TestResult;
    if (model.type === 'embedding') {
      result = await testEmbeddingModel(model.id);
    } else {
      result = await testChatModel(model.id);
    }

    results.push(result);

    if (result.success) {
      console.log(`  ✅ SUCCESS | ${result.latencyMs}ms | ${result.inputTokens || 0} in / ${result.outputTokens || 0} out`);
    } else {
      console.log(`  ❌ FAILED: ${result.error}`);
    }
  }

  // Test JSON mode
  console.log(`\n🧪 Testing: JSON Mode (Entity Extraction)`);
  console.log('─'.repeat(50));
  const jsonResult = await testJsonMode();
  results.push(jsonResult);
  if (jsonResult.success) {
    console.log(`  ✅ SUCCESS | ${jsonResult.latencyMs}ms | ${jsonResult.inputTokens || 0} in / ${jsonResult.outputTokens || 0} out`);
  } else {
    console.log(`  ❌ FAILED: ${jsonResult.error}`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY                                ');
  console.log('═══════════════════════════════════════════════════════════════');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTokens = results.reduce((sum, r) => sum + (r.inputTokens || 0) + (r.outputTokens || 0), 0);

  console.log(`\n  ✅ Passed: ${passed}/${results.length}`);
  console.log(`  ❌ Failed: ${failed}/${results.length}`);
  console.log(`  📊 Total tokens used: ${totalTokens}`);
  console.log();

  // Table
  console.log('┌────────────────────────────┬─────────┬──────────┬────────────┐');
  console.log('│ Model                      │ Status  │ Latency  │ Tokens     │');
  console.log('├────────────────────────────┼─────────┼──────────┼────────────┤');

  for (const r of results) {
    const status = r.success ? '✅ OK' : '❌ FAIL';
    const latency = `${r.latencyMs}ms`.padEnd(8);
    const tokens = r.success ? `${r.inputTokens || 0}/${r.outputTokens || 0}` : '-';
    const model = r.model.padEnd(26);
    console.log(`│ ${model} │ ${status.padEnd(7)} │ ${latency} │ ${tokens.padEnd(10)} │`);
  }

  console.log('└────────────────────────────┴─────────┴──────────┴────────────┘');

  if (failed > 0) {
    console.log('\n⚠️  Some models failed. Check error messages above.');
    console.log('   Common issues:');
    console.log('   - Invalid API key');
    console.log('   - Model not available in your region');
    console.log('   - Free quota exhausted');
    process.exit(1);
  } else {
    console.log('\n🎉 All models working! Free trial is active.');
    console.log('   Each model has 1M free tokens (expires 2026-06-29)');
  }
}

main().catch(console.error);
