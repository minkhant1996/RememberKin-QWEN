/**
 * Test Qwen Cloud API Free Trial
 */

import OpenAI from 'openai';
import { config } from './config/index.js';

const client = new OpenAI({
  apiKey: config.qwen.apiKey,
  baseURL: config.qwen.baseUrl,
});

// BALANCED models - cheap & powerful
const MODELS = [
  { id: 'qwen-plus', type: 'chat', desc: 'Chat ($0.80/$2.40)' },
  { id: 'qwen-turbo', type: 'chat', desc: 'Extract/Fast ($0.05/$0.20)' },
  { id: 'text-embedding-v3', type: 'embed', desc: 'Embeddings ($0.07)' },
];

async function testChat(model: string) {
  const start = Date.now();
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Reply in exactly 5 words.' },
      { role: 'user', content: 'Say hello from Qwen!' },
    ],
    max_tokens: 50,
  });
  return {
    ok: true,
    ms: Date.now() - start,
    text: res.choices[0]?.message?.content,
    tokens: { in: res.usage?.prompt_tokens, out: res.usage?.completion_tokens },
  };
}

async function testEmbed(model: string) {
  const start = Date.now();
  const res = await client.embeddings.create({
    model,
    input: 'Family memories are precious.',
  });
  return {
    ok: true,
    ms: Date.now() - start,
    dims: res.data[0]?.embedding?.length,
    tokens: { in: 5, out: 0 },
  };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('         QWEN CLOUD API FREE TRIAL TEST');
  console.log('═'.repeat(60));
  console.log(`\nAPI Key: ${config.qwen.apiKey?.slice(0, 15)}...`);
  console.log(`Base URL: ${config.qwen.baseUrl}\n`);

  let passed = 0, failed = 0;

  for (const m of MODELS) {
    process.stdout.write(`Testing ${m.id.padEnd(20)} ... `);
    try {
      const r = m.type === 'embed' ? await testEmbed(m.id) : await testChat(m.id);
      console.log(`✅ ${r.ms}ms | ${r.tokens.in}/${r.tokens.out} tokens`);
      if (m.type === 'chat') console.log(`   Response: "${r.text}"`);
      if (m.type === 'embed') console.log(`   Dimensions: ${r.dims}`);
      passed++;
    } catch (e: any) {
      console.log(`❌ ${e.message?.slice(0, 50)}`);
      failed++;
    }
  }

  // Test JSON mode with qwen-plus (supports JSON mode)
  process.stdout.write(`Testing JSON mode (qwen-plus) ... `);
  try {
    const start = Date.now();
    const res = await client.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: 'Extract people and facts. Return JSON only: {"people": ["name"], "facts": ["fact"]}' },
        { role: 'user', content: 'Grandma Rose loves apple pie and lives in Boston.' },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });
    const json = JSON.parse(res.choices[0]?.message?.content || '{}');
    console.log(`✅ ${Date.now() - start}ms`);
    console.log(`   JSON:`, JSON.stringify(json));
    passed++;
  } catch (e: any) {
    console.log(`❌ ${e.message?.slice(0, 60)}`);
    failed++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Free trial is working.');
    console.log('   Each model has 1M free tokens.');
  } else {
    console.log('\n⚠️  Some tests failed. Check your API key or quota.');
    process.exit(1);
  }
}

main().catch(console.error);
