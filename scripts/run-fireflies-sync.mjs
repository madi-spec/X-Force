/**
 * Run Fireflies sync with AI entity matching
 * Usage: node scripts/run-fireflies-sync.mjs
 *
 * This script bypasses the API and runs the sync function directly.
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env vars from .env.local
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.error('Could not load .env.local:', e.message);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Fireflies GraphQL client
const FIREFLIES_API = 'https://api.fireflies.ai/graphql';

async function firefliesQuery(apiKey, query, variables = {}) {
  const response = await fetch(FIREFLIES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();
  if (result.errors?.length > 0) {
    throw new Error(result.errors.map(e => e.message).join(', '));
  }
  return result.data;
}

async function getFirefliesTranscripts(apiKey, limit = 10) {
  const query = `
    query RecentTranscripts($limit: Int) {
      transcripts(limit: $limit) {
        id
        title
        date
        duration
        organizer_email
        participants
      }
    }
  `;
  const data = await firefliesQuery(apiKey, query, { limit });
  return data.transcripts || [];
}

async function getFirefliesTranscript(apiKey, transcriptId) {
  const query = `
    query GetTranscript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        duration
        organizer_email
        participants
        transcript_url
        audio_url
        video_url
        summary {
          overview
          shorthand_bullet
          action_items
          outline
          keywords
        }
        sentences {
          speaker_name
          speaker_id
          text
          raw_text
          start_time
          end_time
        }
      }
    }
  `;
  const data = await firefliesQuery(apiKey, query, { transcriptId });
  return data.transcript;
}

function parseParticipants(participants) {
  if (!participants) return [];
  return participants.map(p => {
    const emailMatch = p.match(/<(.+)>/);
    const email = emailMatch ? emailMatch[1] : undefined;
    const name = emailMatch ? p.replace(/<.+>/, '').trim() : p;
    return { name, email };
  });
}

function buildTranscriptText(sentences) {
  if (!sentences?.length) return '';
  return sentences.map(s => `${s.speaker_name}: ${s.text}`).join('\n');
}

async function aiMatchTranscript(transcriptText, title, participants) {
  console.log('   Running AI entity matching...');

  // Get companies and deals for context
  const [companiesRes, dealsRes] = await Promise.all([
    supabase.from('companies').select('id, name, status, segment').limit(100),
    supabase.from('deals').select('id, name, stage, company_id, company:companies(name)')
      .not('stage', 'in', '("closed_won","closed_lost")').limit(50),
  ]);

  const companies = companiesRes.data || [];
  const deals = (dealsRes.data || []).map(d => ({
    id: d.id,
    name: d.name,
    stage: d.stage,
    company_name: Array.isArray(d.company) ? d.company[0]?.name : d.company?.name,
  }));

  const prompt = `Analyze this meeting transcript and determine which company and deal it should be assigned to.

## Meeting Title
${title}

## Participants
${participants.map(p => `- ${p.name}${p.email ? ` (${p.email})` : ''}`).join('\n')}

## Transcript (first 5000 chars)
${transcriptText.slice(0, 5000)}

## Available Companies
${companies.map(c => `- ${c.name} (ID: ${c.id})`).join('\n').slice(0, 2000)}

## Active Deals
${deals.map(d => `- ${d.name} at ${d.company_name} (ID: ${d.id})`).join('\n').slice(0, 2000)}

Respond with JSON:
{
  "companyMatch": { "id": "uuid or null", "name": "name", "matchScore": 0.0-1.0, "matchReasons": ["reason"] } | null,
  "dealMatch": { "id": "uuid or null", "name": "name", "matchScore": 0.0-1.0, "matchReasons": ["reason"] } | null,
  "overallConfidence": 0.0-1.0,
  "reasoning": "explanation",
  "extractedCompanyName": "company mentioned in transcript or null",
  "requiresHumanReview": true/false,
  "reviewReason": "why review needed or null"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  let jsonText = response.content[0].text;
  const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[1] || jsonMatch[0];
  }

  return JSON.parse(jsonText);
}

async function extractEntityData(transcriptText, title, participants) {
  console.log('   Extracting entity data with AI...');

  const participantList = participants.map(p => `- ${p.name}${p.email ? ` (${p.email})` : ''}`).join('\n');

  const prompt = `Extract information from this meeting transcript to create new CRM records.

## Context
X-RAI Labs sells Voice phone systems and AI solutions to pest control and lawn care companies.

## Meeting Title
${title}

## Participants
${participantList}

## Transcript (first 8000 chars)
${transcriptText.slice(0, 8000)}

Extract company, contacts, and deal information. Respond with JSON:
{
  "company": {
    "name": "Company name from conversation or email domain",
    "industry": "pest|lawn|both|null",
    "segment": "smb|mid_market|enterprise|null (smb=1-5 agents, mid_market=6-20, enterprise=21+)",
    "estimatedAgentCount": number or null,
    "crmPlatform": "fieldroutes|pestpac|realgreen|null"
  },
  "contacts": [
    {"name": "Name", "email": "email or null", "title": "title or null", "role": "decision_maker|influencer|champion|null", "isPrimary": true/false}
  ],
  "deal": {
    "suggestedName": "Company name",
    "estimatedValue": number (SMB $5-15K, Mid-Market $15-50K, Enterprise $50-150K),
    "productInterests": ["Voice", "X-RAI", "AI Agents"],
    "salesTeam": "voice_outside|voice_inside|xrai|null"
  },
  "confidence": 0.0-1.0
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  let jsonText = response.content[0].text;
  const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[1] || jsonMatch[0];
  }

  return JSON.parse(jsonText);
}

async function main() {
  console.log('=== Fireflies Sync with AI Matching ===\n');

  // 1. Get Fireflies connection
  const { data: connections } = await supabase
    .from('fireflies_connections')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  if (!connections?.length) {
    console.log('No active Fireflies connections found.');
    process.exit(0);
  }

  const conn = connections[0];
  console.log(`User ID: ${conn.user_id}`);
  console.log(`Last sync: ${conn.last_sync_at || 'Never'}\n`);

  // 2. Fetch recent transcripts
  console.log('Fetching transcripts from Fireflies...');
  let transcripts;
  try {
    transcripts = await getFirefliesTranscripts(conn.api_key, 20);
    console.log(`Found ${transcripts.length} transcripts\n`);
  } catch (e) {
    console.error('Failed to fetch transcripts:', e.message);
    process.exit(1);
  }

  if (!transcripts.length) {
    console.log('No transcripts found.');
    process.exit(0);
  }

  // 3. Process each transcript
  let synced = 0, skipped = 0, reviewTasks = 0;

  for (const item of transcripts) {
    const firefliesId = `fireflies_${item.id}`;
    console.log(`\nProcessing: "${item.title}"`);

    // Check if already synced
    const { data: existing } = await supabase
      .from('meeting_transcriptions')
      .select('id')
      .eq('external_id', firefliesId)
      .single();

    if (existing) {
      console.log('   Already synced, skipping.');
      skipped++;
      continue;
    }

    // Fetch full transcript
    console.log('   Fetching full transcript...');
    let transcript;
    try {
      transcript = await getFirefliesTranscript(conn.api_key, item.id);
    } catch (e) {
      console.error('   Failed:', e.message);
      continue;
    }

    const participants = parseParticipants(transcript.participants);
    const transcriptText = buildTranscriptText(transcript.sentences);

    if (!transcriptText || transcriptText.length < 100) {
      console.log('   Transcript too short, skipping AI matching.');
    }

    // Run AI matching
    let aiMatch = null;
    if (transcriptText.length >= 100) {
      try {
        aiMatch = await aiMatchTranscript(transcriptText, transcript.title, participants);
        console.log(`   AI confidence: ${(aiMatch.overallConfidence * 100).toFixed(0)}%`);
        if (aiMatch.companyMatch) {
          console.log(`   Matched company: ${aiMatch.companyMatch.name}`);
        }
        if (aiMatch.dealMatch) {
          console.log(`   Matched deal: ${aiMatch.dealMatch.name}`);
        }
        if (aiMatch.requiresHumanReview) {
          console.log(`   Needs review: ${aiMatch.reviewReason}`);
        }
      } catch (e) {
        console.error('   AI matching failed:', e.message);
      }
    }

    // Save transcript
    const meetingDate = new Date(transcript.date > 9999999999 ? transcript.date : transcript.date * 1000);

    const { data: saved, error: saveError } = await supabase
      .from('meeting_transcriptions')
      .insert({
        user_id: conn.user_id,
        deal_id: aiMatch?.dealMatch?.id || null,
        company_id: aiMatch?.companyMatch?.id || null,
        title: transcript.title || 'Untitled Meeting',
        meeting_date: meetingDate.toISOString().split('T')[0],
        duration_minutes: Math.round((transcript.duration || 0) / 60),
        attendees: transcript.participants || [],
        transcription_text: transcriptText || `[No transcript for: ${transcript.title}]`,
        transcription_format: 'fireflies',
        word_count: transcriptText?.split(/\s+/).length || 0,
        source: 'fireflies',
        external_id: firefliesId,
        external_metadata: {
          fireflies_id: transcript.id,
          organizer_email: transcript.organizer_email,
          fireflies_summary: transcript.summary,
          match_method: aiMatch ? 'ai' : 'none',
          ai_match_result: aiMatch,
        },
        match_confidence: aiMatch?.overallConfidence || 0,
      })
      .select()
      .single();

    if (saveError) {
      console.error('   Save failed:', saveError.message);
      continue;
    }

    synced++;
    console.log('   Saved successfully.');

    // If no match, extract entity data and create review task with suggestions
    if (!aiMatch?.companyMatch && !aiMatch?.dealMatch && transcriptText.length > 100) {
      console.log('   No match found, extracting entity data for review task...');

      const extractedData = await extractEntityData(transcriptText, transcript.title, participants);

      if (extractedData?.company?.name) {
        console.log(`   Extracted company: ${extractedData.company.name}`);
        console.log(`   Industry: ${extractedData.company.industry}, Segment: ${extractedData.company.segment}`);
        console.log(`   Contacts: ${extractedData.contacts?.length || 0}`);
        console.log(`   Product interests: ${extractedData.deal?.productInterests?.join(', ') || 'none'}`);

        // Find similar companies
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name, status')
          .limit(500);

        const searchTerms = extractedData.company.name.toLowerCase().split(/\s+/);
        const similarCompanies = (companies || [])
          .map(c => {
            const nameLower = c.name.toLowerCase();
            const matchedTerms = searchTerms.filter(term =>
              nameLower.includes(term) || term.includes(nameLower.split(/\s+/)[0])
            );
            return { ...c, matchedTerms: matchedTerms.length };
          })
          .filter(c => c.matchedTerms > 0)
          .sort((a, b) => b.matchedTerms - a.matchedTerms)
          .slice(0, 5);

        if (similarCompanies.length > 0) {
          console.log('   Similar existing companies found:');
          similarCompanies.forEach(c => console.log(`     - ${c.name} (${c.status})`));
        }

        // Store extracted data in metadata
        await supabase
          .from('meeting_transcriptions')
          .update({
            external_metadata: {
              ...saved.external_metadata,
              extracted_entity_data: extractedData,
            },
          })
          .eq('id', saved.id);

        // Build review task description
        const taskDesc = [
          `Meeting transcript "${transcript.title}" could not be automatically matched.`,
          '',
          '═══ EXTRACTED INFO ═══',
          `Company: ${extractedData.company.name}`,
          `Industry: ${extractedData.company.industry || 'Unknown'}`,
          `Segment: ${extractedData.company.segment || 'Unknown'}`,
          '',
          'Contacts:',
          ...(extractedData.contacts || []).map(c => `  - ${c.name} ${c.email ? `<${c.email}>` : ''} (${c.role || 'unknown role'})`),
          '',
          `Products: ${extractedData.deal?.productInterests?.join(', ') || 'Unknown'}`,
          `Est. Value: $${extractedData.deal?.estimatedValue?.toLocaleString() || 'Unknown'}`,
        ];

        if (similarCompanies.length > 0) {
          taskDesc.push('', '═══ SIMILAR COMPANIES ═══');
          taskDesc.push('⚠️ Check if this matches an existing company:');
          similarCompanies.forEach(c => taskDesc.push(`  - ${c.name} (${c.status})`));
        }

        taskDesc.push('', '═══ ACTION REQUIRED ═══');
        taskDesc.push('Option A: Match to existing company/deal');
        taskDesc.push('Option B: Create new company, contacts, and deal');
        taskDesc.push('', `Transcription ID: ${saved.id}`);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2);
        await supabase.from('tasks').insert({
          assigned_to: conn.user_id,
          type: 'review',
          title: `Assign transcript: ${extractedData.company.name}`,
          description: taskDesc.join('\n'),
          priority: 'high',
          due_at: dueDate.toISOString(),
          source: 'fireflies_ai',
        });
        reviewTasks++;
        console.log('   Created review task with extracted data and similar company suggestions.');
      } else {
        // Create simple review task
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2);
        await supabase.from('tasks').insert({
          assigned_to: conn.user_id,
          type: 'review',
          title: `Review transcript assignment: ${transcript.title}`,
          description: `Could not extract entity data from transcript.\n\nAI Reasoning: ${aiMatch?.reasoning || 'N/A'}`,
          priority: 'medium',
          due_at: dueDate.toISOString(),
          source: 'fireflies_ai',
        });
        reviewTasks++;
        console.log('   Created review task (no entity data extracted).');
      }
    } else if (aiMatch?.requiresHumanReview) {
      // Matched but needs review
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      await supabase.from('tasks').insert({
        deal_id: aiMatch?.dealMatch?.id || null,
        company_id: aiMatch?.companyMatch?.id || null,
        assigned_to: conn.user_id,
        type: 'review',
        title: `Review transcript assignment: ${transcript.title}`,
        description: `AI Analysis:\n${aiMatch?.reasoning || 'No AI analysis available'}\n\nReview Reason: ${aiMatch?.reviewReason || 'Low confidence match'}`,
        priority: 'medium',
        due_at: dueDate.toISOString(),
        source: 'fireflies_ai',
      });
      reviewTasks++;
      console.log('   Created review task.');
    }
  }

  // Update connection
  await supabase
    .from('fireflies_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      transcripts_synced: (conn.transcripts_synced || 0) + synced,
    })
    .eq('id', conn.id);

  console.log('\n=== Sync Complete ===');
  console.log(`Synced: ${synced}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Review tasks created: ${reviewTasks}`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
