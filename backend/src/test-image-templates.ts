/**
 * Test Image Template System
 */

import { PROMPT_TEMPLATES, fillTemplate, imageProviders } from './services/image.service.js';

async function testTemplates() {
  console.log('═'.repeat(60));
  console.log('         IMAGE TEMPLATE SYSTEM TEST');
  console.log('═'.repeat(60));
  console.log();

  // Test 1: fillTemplate function
  console.log('1. Testing fillTemplate function:');

  const tests = [
    {
      template: '{{description}}. Style: {{style}}{{extra}}',
      vars: { description: 'A happy family', style: 'photorealistic' },
      expected: 'A happy family. Style: photorealistic',
    },
    {
      template: '{{basePrompt}} in {{season}}{{extra}}',
      vars: { basePrompt: 'A cat', season: 'spring', extra: ', sunny day' },
      expected: 'A cat in spring, sunny day',
    },
    {
      template: 'Family with {{members}}{{location}}',
      vars: { members: 'grandparents' },  // location not provided
      expected: 'Family with grandparents',
    },
  ];

  tests.forEach((test, i) => {
    const result = fillTemplate(test.template, test.vars);
    const passed = result === test.expected;
    console.log(`   ${passed ? '✅' : '❌'} Test ${i + 1}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) {
      console.log(`      Expected: "${test.expected}"`);
      console.log(`      Got:      "${result}"`);
    }
  });
  console.log();

  // Test 2: Available templates
  console.log('2. Available Templates:');
  Object.entries(PROMPT_TEMPLATES).forEach(([category, templates]) => {
    console.log(`   ${category}:`);
    Object.entries(templates as Record<string, string>).forEach(([name, template]) => {
      // Extract variables from template
      const vars = template.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) || [];
      console.log(`     - ${name}: [${vars.join(', ')}]`);
    });
  });
  console.log();

  // Test 3: Generate from template (actual API call)
  console.log('3. Testing generateFromTemplate (API call):');
  try {
    const result = await imageProviders.generateFromTemplate(
      'family',
      'portrait',
      {
        members: 'grandparents and two children',
        location: ' in a sunny garden',
        extra: ', warm golden hour lighting',
      }
    );
    console.log(`   ✅ Success!`);
    console.log(`   - Prompt would be: "A warm family portrait of grandparents and two children in a sunny garden, warm golden hour lighting"`);
    console.log(`   - Images: ${result.images.length}`);
    console.log(`   - Cost: $${result.cost.totalCost}`);
    console.log(`   - URL: ${result.images[0]?.url?.slice(0, 60)}...`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log();

  // Test 4: Family portrait helper
  console.log('4. Testing generateFamilyPortrait helper:');
  try {
    const result = await imageProviders.generateFamilyPortrait(
      'Mom, Dad, and baby',
      { location: 'the living room', extra: ', cozy Christmas atmosphere' }
    );
    console.log(`   ✅ Success!`);
    console.log(`   - Images: ${result.images.length}`);
    console.log(`   - Cost: $${result.cost.totalCost}`);
    console.log(`   - URL: ${result.images[0]?.url?.slice(0, 60)}...`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log();

  // Test 5: Celebration helper
  console.log('5. Testing generateCelebration helper:');
  try {
    const result = await imageProviders.generateCelebration(
      'Birthday',
      'Grandma surrounded by family',
      { decorations: 'colorful balloons and a big cake', extra: ', joyful atmosphere' }
    );
    console.log(`   ✅ Success!`);
    console.log(`   - Images: ${result.images.length}`);
    console.log(`   - Cost: $${result.cost.totalCost}`);
    console.log(`   - URL: ${result.images[0]?.url?.slice(0, 60)}...`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Test complete!');
}

testTemplates().catch(console.error);
