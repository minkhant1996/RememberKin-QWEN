/**
 * Test Image Generation API
 */

import { config } from './config/index.js';
import { imageProviders } from './services/image.service.js';

async function testImageGeneration() {
  console.log('═'.repeat(60));
  console.log('         IMAGE GENERATION API TEST');
  console.log('═'.repeat(60));
  console.log(`\nAPI Key: ${config.qwen.apiKey?.slice(0, 15)}...`);
  console.log();

  // Test 1: Get available models
  console.log('1. Available Models:');
  const models = imageProviders.getPricing();
  models.forEach(m => {
    console.log(`   - ${m.id}: $${m.pricePerImage}/image`);
  });
  console.log();

  // Test 2: Try different models (qwen-image-2.0 is the main model)
  const modelsToTest = ['qwen-image-2.0', 'wanx2.1-t2i-turbo', 'wanx-v1'];

  for (const model of modelsToTest) {
    console.log(`2. Testing ${model}...`);
    try {
      const result = await imageProviders.textToImage(
        'A happy family portrait',
        {
          model,
          n: 1,
        }
      );
      console.log(`   ✅ Success with ${model}!`);
      console.log(`   - Images: ${result.images.length}`);
      console.log(`   - Cost: $${result.cost.totalCost}`);
      console.log(`   - Latency: ${result.latencyMs}ms`);
      if (result.images[0]?.url) {
        console.log(`   - URL: ${result.images[0].url.slice(0, 80)}...`);
      } else if (result.images.length === 0) {
        console.log(`   - Note: API succeeded but image URL extraction needs review`);
        console.log(`   - Raw result keys: ${JSON.stringify(Object.keys(result))}`);
      }
      break; // Stop after first successful model
    } catch (error: any) {
      console.log(`   ❌ ${model} failed: ${error.message?.slice(0, 50)}`);
    }
  }
  console.log();

  // Test 3: Memory image generation
  console.log('3. Testing memory visualization...');
  try {
    const result = await imageProviders.generateMemoryImage(
      'Grandma teaching her grandchildren to bake cookies in a cozy kitchen',
      'vintage'
    );
    console.log(`   ✅ Success!`);
    console.log(`   - Images: ${result.images.length}`);
    console.log(`   - Cost: $${result.cost.totalCost}`);
    console.log(`   - Latency: ${result.latencyMs}ms`);
    if (result.images[0]?.url) {
      console.log(`   - URL: ${result.images[0].url.slice(0, 80)}...`);
    }
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Test complete!');
}

testImageGeneration().catch(console.error);
