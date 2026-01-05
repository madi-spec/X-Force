/**
 * Test script for Pest Control Intelligence Agent v6.1
 * Run with: npx tsx scripts/test-research-v61.ts [company_name] [domain]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { researchCompanyV61, formatResearchOutputV61 } from '../src/lib/intelligence/researchAgentV61';

async function main() {
  const companyName = process.argv[2] || 'Go-Forth Home Services';
  const domain = process.argv[3] || 'go-forth.com';

  console.log(`\n🔍 PEST CONTROL INTELLIGENCE v6.1`);
  console.log(`   Company: ${companyName}`);
  console.log(`   Domain: ${domain}\n`);

  try {
    const result = await researchCompanyV61({
      companyName,
      domain,
      state: null,
    });

    // Print markdown report
    console.log('\n' + '═'.repeat(70));
    console.log('📄 MARKDOWN REPORT');
    console.log('═'.repeat(70) + '\n');
    console.log(formatResearchOutputV61(result));

    // Print tech stack details (for v6.1 validation)
    console.log('\n' + '═'.repeat(70));
    console.log('💻 TECH STACK ANALYSIS (v6.1)');
    console.log('═'.repeat(70) + '\n');
    if (result.tech_stack.length > 0) {
      for (const tech of result.tech_stack) {
        const status = tech.is_known_vendor ? '✓ KNOWN' : '⚠ UNKNOWN/BRANDED';
        console.log(`  ${status}: ${tech.vendor} (${tech.category})`);
        console.log(`    Method: ${tech.detection_method}`);
        if (tech.evidence) {
          console.log(`    Evidence: ${tech.evidence}`);
        }
        console.log('');
      }
    } else {
      console.log('  No technology detected');
    }

    // Save outputs
    const fs = await import('fs');

    // Save markdown report
    const mdPath = `./research-v61-${domain.replace(/\./g, '-')}.md`;
    fs.writeFileSync(mdPath, result.markdown_report);
    console.log(`\n📄 Markdown report: ${mdPath}`);

    // Save JSON
    const jsonPath = `./research-v61-${domain.replace(/\./g, '-')}.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    console.log(`📄 JSON output: ${jsonPath}`);

  } catch (error) {
    console.error('\n❌ Research failed:', error);
    process.exit(1);
  }
}

main();
