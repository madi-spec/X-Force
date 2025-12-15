import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeMeetingTranscription(transcriptText, context = {}) {
  const startTime = Date.now();

  const prompt = `You are an expert sales analyst for a B2B SaaS company that sells voice phone systems and AI solutions to the pest control and lawn care industry. Analyze this meeting transcription and extract actionable intelligence.

## Meeting Information
- Title: ${context.title || 'Sales Meeting'}
- Date: ${context.meetingDate || 'Unknown'}
- Attendees: ${context.attendees?.join(', ') || 'Not specified'}

## Transcription
${transcriptText}

---

Analyze this meeting and provide a comprehensive JSON response with this exact structure. Be thorough and extract all relevant information:

\`\`\`json
{
  "summary": "2-3 paragraph summary of the meeting covering key discussion points, outcomes, and next steps",
  "headline": "One sentence headline capturing the essence of the meeting",

  "keyPoints": [
    {"topic": "Topic discussed", "details": "What was said about this topic", "importance": "high|medium|low"}
  ],

  "stakeholders": [
    {
      "name": "Person Name",
      "role": "Their role/title if mentioned or inferred",
      "sentiment": "positive|neutral|negative",
      "keyQuotes": ["Notable things they said that reveal their position or concerns"]
    }
  ],

  "buyingSignals": [
    {"signal": "What indicates buying interest", "quote": "Exact or paraphrased quote if available", "strength": "strong|moderate|weak"}
  ],

  "objections": [
    {
      "objection": "The concern or objection raised",
      "context": "Why they raised this concern",
      "howAddressed": "How we responded to this or null if not addressed",
      "resolved": true
    }
  ],

  "actionItems": [
    {
      "task": "Specific actionable task",
      "owner": "us|them",
      "assignee": "Person name if mentioned or null",
      "dueDate": "Date if mentioned (YYYY-MM-DD format) or null",
      "priority": "high|medium|low"
    }
  ],

  "theirCommitments": [
    {"commitment": "What they promised to do", "who": "Person name", "when": "Timeframe or null"}
  ],

  "ourCommitments": [
    {"commitment": "What we promised to do", "when": "Timeframe or null"}
  ],

  "sentiment": {
    "overall": "very_positive|positive|neutral|negative|very_negative",
    "interestLevel": "high|medium|low",
    "urgency": "high|medium|low",
    "trustLevel": "established|building|uncertain"
  },

  "extractedInfo": {
    "companySize": "Number of employees/agents if mentioned or null",
    "currentSolution": "What they currently use or null",
    "budget": "Budget mentioned or null",
    "timeline": "When they want to decide/implement or null",
    "decisionProcess": "How decisions are made in their organization or null",
    "competitors": ["Any competitors mentioned"],
    "painPoints": ["Problems or challenges they mentioned"]
  },

  "recommendations": [
    {
      "type": "stage_change|deal_value|add_contact|schedule_meeting|send_content|other",
      "action": "What action to take",
      "reasoning": "Why this is recommended based on the meeting",
      "data": {}
    }
  ],

  "followUpEmail": {
    "subject": "Professional email subject line",
    "body": "Full email body with proper formatting, personalized based on the meeting discussion. Include specific references to what was discussed, any commitments made, and clear next steps.",
    "attachmentSuggestions": ["Documents or materials to attach based on the discussion"]
  },

  "confidence": 0.85
}
\`\`\`

Important guidelines:
- Be specific and actionable in your analysis
- Quote directly from the transcript when possible to support your analysis
- Identify ALL action items, including implicit ones
- The follow-up email should be professional but warm, reference specific discussion points, and clearly state next steps
- Recommendations should be concrete and based on evidence from the meeting
- If information isn't explicitly stated in the transcript, use null rather than guessing
- For the confidence score, consider how complete the transcript is and how clear the discussion was (0.0 to 1.0)
- Ensure all arrays have at least one item if relevant content exists, or empty arrays if none

Respond ONLY with the JSON object inside markdown code blocks, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Extract JSON from response (handle markdown code blocks)
  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    const rawJsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (rawJsonMatch) {
      jsonText = rawJsonMatch[0];
    }
  }

  const analysis = JSON.parse(jsonText);
  const processingTime = Date.now() - startTime;

  return {
    ...analysis,
    processingTime,
  };
}

async function runAnalysis() {
  console.log('=== Re-analyzing Transcripts with Correct Format ===\n');

  // Get transcripts that have deal_id (regardless of whether they have analysis)
  // This will re-analyze with the correct format
  const { data: transcripts, error } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, attendees, transcription_text, word_count, deal_id, analysis')
    .not('deal_id', 'is', null)
    .gt('word_count', 50);

  if (error) {
    console.error('Error fetching transcripts:', error.message);
    return;
  }

  // Filter to only those that need re-analysis (missing extractedInfo structure)
  const needsReanalysis = transcripts.filter(t => {
    if (!t.analysis) return true;
    if (!t.analysis.extractedInfo) return true;
    if (!t.analysis.headline) return true;
    return false;
  });

  console.log(`Found ${needsReanalysis.length} transcripts needing re-analysis\n`);

  let analyzed = 0;
  let skipped = 0;
  let errors = 0;

  for (const transcript of needsReanalysis) {
    console.log(`\nAnalyzing: "${transcript.title}"...`);

    if (!transcript.transcription_text || transcript.transcription_text.length < 100) {
      console.log('  [SKIP] Insufficient transcript text');
      skipped++;
      continue;
    }

    try {
      const analysis = await analyzeMeetingTranscription(transcript.transcription_text, {
        title: transcript.title,
        meetingDate: transcript.meeting_date,
        attendees: transcript.attendees,
      });

      // Update the transcript with analysis
      const { error: updateError } = await supabase
        .from('meeting_transcriptions')
        .update({
          analysis,
          analysis_generated_at: new Date().toISOString(),
          summary: analysis.summary,
          follow_up_email_draft: analysis.followUpEmail?.body,
        })
        .eq('id', transcript.id);

      if (updateError) {
        console.log('  [ERROR] Failed to save:', updateError.message);
        errors++;
      } else {
        console.log('  [SUCCESS] Analysis saved');
        analyzed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.log('  [ERROR]', err.message);
      errors++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Analyzed: ${analyzed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

runAnalysis().catch(console.error);
