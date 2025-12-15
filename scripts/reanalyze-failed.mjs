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

Analyze this meeting and provide a comprehensive JSON response with this exact structure:

{
  "summary": "2-3 paragraph summary of the meeting covering key discussion points, outcomes, and next steps",
  "headline": "One sentence headline capturing the essence of the meeting",
  "keyPoints": [
    {"topic": "Topic discussed", "details": "What was said about this topic", "importance": "high"}
  ],
  "stakeholders": [
    {
      "name": "Person Name",
      "role": "Their role/title if mentioned or inferred",
      "sentiment": "positive",
      "keyQuotes": ["Notable things they said"]
    }
  ],
  "buyingSignals": [
    {"signal": "What indicates buying interest", "quote": "Exact or paraphrased quote", "strength": "strong"}
  ],
  "objections": [
    {
      "objection": "The concern or objection raised",
      "context": "Why they raised this concern",
      "howAddressed": "How we responded or null",
      "resolved": true
    }
  ],
  "actionItems": [
    {
      "task": "Specific actionable task",
      "owner": "us",
      "assignee": null,
      "dueDate": null,
      "priority": "high"
    }
  ],
  "theirCommitments": [
    {"commitment": "What they promised to do", "who": "Person name", "when": null}
  ],
  "ourCommitments": [
    {"commitment": "What we promised to do", "when": null}
  ],
  "sentiment": {
    "overall": "positive",
    "interestLevel": "high",
    "urgency": "medium",
    "trustLevel": "building"
  },
  "extractedInfo": {
    "companySize": null,
    "currentSolution": null,
    "budget": null,
    "timeline": null,
    "decisionProcess": null,
    "competitors": [],
    "painPoints": []
  },
  "recommendations": [
    {
      "type": "schedule_meeting",
      "action": "What action to take",
      "reasoning": "Why this is recommended",
      "data": {}
    }
  ],
  "followUpEmail": {
    "subject": "Professional email subject line",
    "body": "Full email body with proper formatting.",
    "attachmentSuggestions": []
  },
  "confidence": 0.85
}

Important: Return ONLY valid JSON. No markdown code blocks. No extra text. Just the JSON object.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Extract JSON - try multiple approaches
  let jsonText = content.text.trim();

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonText = match[1];
  }

  // Find the JSON object
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    jsonText = jsonText.substring(start, end + 1);
  }

  const analysis = JSON.parse(jsonText);
  const processingTime = Date.now() - startTime;

  return { ...analysis, processingTime };
}

async function reanalyzeFailed() {
  console.log('=== Re-analyzing Failed Transcripts ===\n');

  // Find the 2 that failed
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, attendees, transcription_text, analysis')
    .or('title.ilike.%Billy Olesen%,title.eq.AI Discovery Session');

  const needsReanalysis = transcripts?.filter(t => !t.analysis?.extractedInfo) || [];

  console.log(`Found ${needsReanalysis.length} transcripts needing re-analysis\n`);

  for (const transcript of needsReanalysis) {
    console.log(`Analyzing: "${transcript.title}"...`);

    try {
      const analysis = await analyzeMeetingTranscription(transcript.transcription_text, {
        title: transcript.title,
        meetingDate: transcript.meeting_date,
        attendees: transcript.attendees,
      });

      const { error } = await supabase
        .from('meeting_transcriptions')
        .update({
          analysis,
          analysis_generated_at: new Date().toISOString(),
          summary: analysis.summary,
          follow_up_email_draft: analysis.followUpEmail?.body,
        })
        .eq('id', transcript.id);

      if (error) {
        console.log('  [ERROR]', error.message);
      } else {
        console.log('  [SUCCESS]');
      }
    } catch (err) {
      console.log('  [ERROR]', err.message);
    }
  }

  console.log('\n=== Done ===');
}

reanalyzeFailed().catch(console.error);
