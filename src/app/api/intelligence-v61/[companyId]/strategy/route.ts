/**
 * Intelligence Strategy API v6.1
 * POST - Generate sales strategy from extraction
 * GET - Get current strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { getPrompt } from '@/lib/ai/promptManager';

// POST /api/intelligence-v61/[companyId]/strategy
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    // Get the extraction data
    const { data: extraction, error: extractionError } = await supabase
      .from('company_extractions')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (extractionError || !extraction) {
      return NextResponse.json(
        { error: 'No extraction found. Run extraction first.' },
        { status: 404 }
      );
    }

    // Generate strategy using Claude
    const strategy = await generateStrategy(extraction);

    // Save to company_strategies table
    const { data: saved, error: saveError } = await supabase
      .from('company_strategies')
      .upsert({
        company_id: companyId,
        extraction_id: extraction.id,
        ...strategy,
        status: 'generated',
        generated_at: new Date().toISOString(),
        data_snapshot: extraction,
      }, { onConflict: 'company_id' })
      .select()
      .single();

    if (saveError) {
      console.error('[Strategy v6.1] Save error:', saveError);
      return NextResponse.json(
        { error: 'Failed to save strategy' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      strategy: saved,
      message: 'Sales strategy generated successfully.',
    });
  } catch (error) {
    console.error('[Strategy v6.1] Error:', error);
    return NextResponse.json(
      { error: `Strategy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET /api/intelligence-v61/[companyId]/strategy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('company_strategies')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'No strategy found for this company' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      strategy: data,
    });
  } catch (error) {
    console.error('[Strategy v6.1] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve strategy' },
      { status: 500 }
    );
  }
}

// Generate sales strategy using Claude
interface Extraction {
  company_name: string;
  ownership_type: string;
  family_generation?: string;
  pe_firm?: string;
  franchise_brand?: string;
  owner_name?: string;
  employee_count?: number;
  employee_count_range?: string;
  location_count?: number;
  revenue?: number;
  founded_year?: number;
  years_in_business?: number;
  bbb_rating?: string;
  google_rating?: number;
  pct_rank?: number;
  fsm_vendor?: string;
  tech_stack?: Array<{ vendor: string; category: string }>;
  hiring_activity?: string;
  geographic_expansion?: boolean;
  service_line_expansion?: boolean;
  leadership_team?: Array<{ name: string; title: string }>;
  hq_state?: string;
}

async function generateStrategy(extraction: Extraction) {
  const anthropic = new Anthropic();

  // Get prompt configuration from database
  const promptConfig = await getPrompt('strategy_generation');
  const model = promptConfig?.model || 'claude-sonnet-4-20250514';
  const maxTokens = promptConfig?.max_tokens || 4096;

  // Use prompt template from DB or fallback
  let prompt: string;
  if (promptConfig?.prompt_template) {
    prompt = promptConfig.prompt_template
      .replace(/\{\{companyData\}\}/g, JSON.stringify(extraction, null, 2));
  } else {
    // Fallback to hardcoded prompt
    prompt = `You are a pest control industry sales expert. Based on the following company intelligence, generate a comprehensive sales strategy.

## COMPANY DATA
${JSON.stringify(extraction, null, 2)}

## YOUR TASK
Generate a sales strategy with these specific sections. Be concrete and specific to THIS company's situation.

Respond in JSON format with exactly these fields:

{
  "primary_positioning": "One sentence on how to position our solution for this specific company",
  "positioning_emoji": "Single emoji that captures the company type (🏠 family, 💼 PE, 🔗 franchise, etc.)",
  "secondary_positioning": ["Additional positioning angles"],
  "classification_tags": ["Tags like: family-business, growth-mode, tech-forward, etc."],

  "pain_points": ["Specific pain points based on their size/tech/growth"],
  "desired_outcomes": ["What they likely want to achieve"],
  "buying_triggers": ["Events that would trigger a purchase decision"],
  "why_they_buy_summary": "One paragraph on why this company type buys",

  "recommended_approach": "How to approach this specific company",
  "entry_point": "Best entry point (referral, event, cold outreach, etc.)",
  "best_timing": "Best time to reach out based on their situation",
  "target_roles": ["Roles to target at this company"],
  "decision_makers": ["Who makes the final decision"],

  "talking_points": [
    {"point": "Specific talking point", "data_reference": "The data that supports this", "priority": 1}
  ],
  "key_messages": ["Key messages to emphasize"],

  "likely_objections": [
    {"objection": "Likely objection", "response": "How to respond", "likelihood": "high/medium/low"}
  ],

  "discovery_questions": ["Questions to ask in discovery"],
  "qualifying_questions": ["Questions to qualify the opportunity"],

  "things_to_avoid": ["Things NOT to say or do"],
  "sensitive_topics": ["Topics to be careful about"],

  "call_prep_checklist": ["Things to do before the call"],
  "conversation_starters": ["Good ways to start the conversation"],

  "incumbent_vendor": "Their current FSM/tech if known",
  "competitive_angle": "How to position against their current solution",
  "differentiation_points": ["Key differentiators to emphasize"]
}

Consider:
- Ownership type implications (family = relationships, PE = ROI/efficiency, franchise = limited autonomy)
- Company size and growth trajectory
- Current technology and pain points
- Industry position (PCT ranking, awards)
- Decision-making dynamics based on ownership`;
  }

  const response = await anthropic.messages.create({
    model: model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse the JSON response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response format');
  }

  // Extract JSON from the response
  let jsonStr = content.text;
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const strategy = JSON.parse(jsonStr);

    // Generate markdown report
    const markdownReport = generateStrategyMarkdown(extraction, strategy);

    return {
      ...strategy,
      full_report_markdown: markdownReport,
    };
  } catch {
    console.error('Failed to parse strategy JSON:', content.text);
    throw new Error('Failed to parse strategy response');
  }
}

// Generate markdown report for strategy
function generateStrategyMarkdown(extraction: Extraction, strategy: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`# Sales Strategy: ${extraction.company_name}`);
  lines.push('');
  lines.push(`${strategy.positioning_emoji || '🎯'} **${strategy.primary_positioning || 'Strategy pending'}**`);
  lines.push('');

  if (strategy.classification_tags && Array.isArray(strategy.classification_tags)) {
    lines.push(`Tags: ${(strategy.classification_tags as string[]).map(t => `\`${t}\``).join(' ')}`);
    lines.push('');
  }

  lines.push('## Why They Buy');
  lines.push('');
  if (strategy.why_they_buy_summary) {
    lines.push(String(strategy.why_they_buy_summary));
    lines.push('');
  }

  if (strategy.pain_points && Array.isArray(strategy.pain_points)) {
    lines.push('### Pain Points');
    for (const point of strategy.pain_points as string[]) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  if (strategy.buying_triggers && Array.isArray(strategy.buying_triggers)) {
    lines.push('### Buying Triggers');
    for (const trigger of strategy.buying_triggers as string[]) {
      lines.push(`- ${trigger}`);
    }
    lines.push('');
  }

  lines.push('## Recommended Approach');
  lines.push('');
  if (strategy.recommended_approach) {
    lines.push(String(strategy.recommended_approach));
    lines.push('');
  }

  lines.push(`**Entry Point:** ${strategy.entry_point || 'TBD'}`);
  lines.push(`**Best Timing:** ${strategy.best_timing || 'TBD'}`);
  lines.push('');

  if (strategy.target_roles && Array.isArray(strategy.target_roles)) {
    lines.push('### Target Roles');
    for (const role of strategy.target_roles as string[]) {
      lines.push(`- ${role}`);
    }
    lines.push('');
  }

  if (strategy.talking_points && Array.isArray(strategy.talking_points)) {
    lines.push('## Talking Points');
    lines.push('');
    for (const tp of strategy.talking_points as Array<{ point: string; data_reference: string; priority: number }>) {
      lines.push(`### ${tp.priority}. ${tp.point}`);
      lines.push(`*Data: ${tp.data_reference}*`);
      lines.push('');
    }
  }

  if (strategy.likely_objections && Array.isArray(strategy.likely_objections)) {
    lines.push('## Likely Objections');
    lines.push('');
    for (const obj of strategy.likely_objections as Array<{ objection: string; response: string; likelihood: string }>) {
      lines.push(`### "${obj.objection}"`);
      lines.push(`**Likelihood:** ${obj.likelihood}`);
      lines.push(`**Response:** ${obj.response}`);
      lines.push('');
    }
  }

  if (strategy.discovery_questions && Array.isArray(strategy.discovery_questions)) {
    lines.push('## Discovery Questions');
    lines.push('');
    for (const q of strategy.discovery_questions as string[]) {
      lines.push(`- ${q}`);
    }
    lines.push('');
  }

  if (strategy.things_to_avoid && Array.isArray(strategy.things_to_avoid)) {
    lines.push('## Things to Avoid');
    lines.push('');
    for (const item of strategy.things_to_avoid as string[]) {
      lines.push(`- ⚠️ ${item}`);
    }
    lines.push('');
  }

  if (strategy.call_prep_checklist && Array.isArray(strategy.call_prep_checklist)) {
    lines.push('## Call Prep Checklist');
    lines.push('');
    for (const item of strategy.call_prep_checklist as string[]) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push('');
  }

  if (strategy.competitive_angle) {
    lines.push('## Competitive Positioning');
    lines.push('');
    if (strategy.incumbent_vendor) {
      lines.push(`**Current Vendor:** ${strategy.incumbent_vendor}`);
    }
    lines.push(`**Our Angle:** ${strategy.competitive_angle}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated: ${new Date().toISOString()}*`);

  return lines.join('\n');
}
