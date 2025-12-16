import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeMeeting(transcriptText, context) {
  const systemPrompt = `You are an expert sales meeting analyst. Analyze meeting transcripts to extract actionable insights for sales teams.

Your analysis should identify:
1. Overall sentiment and tone of the meeting
2. Key buying signals or objections
3. Action items for both parties
4. Important topics discussed
5. A brief headline summary
6. A follow-up email draft if appropriate

Respond in JSON format.`;

  const userPrompt = `Analyze this sales meeting transcript:

Title: ${context.title}
Date: ${context.meetingDate}
${context.attendees ? 'Attendees: ' + context.attendees.join(', ') : ''}

TRANSCRIPT:
${transcriptText.substring(0, 50000)}

Respond with a JSON object containing:
{
  "summary": "2-3 sentence summary",
  "headline": "One line headline",
  "sentiment": {
    "overall": "positive|neutral|negative",
    "confidence": 0.0-1.0,
    "notes": "brief explanation"
  },
  "buyingSignals": [
    {"signal": "description", "strength": "strong|moderate|weak", "quote": "relevant quote"}
  ],
  "objections": [
    {"objection": "description", "addressed": true/false, "quote": "relevant quote"}
  ],
  "actionItems": [
    {"task": "description", "owner": "us|them", "priority": "high|medium|low", "dueDate": "suggested date or null"}
  ],
  "keyTopics": ["topic1", "topic2"],
  "followUpEmail": {
    "subject": "email subject",
    "body": "email body"
  }
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

async function main() {
  console.log('=== Analyzing Pending Transcripts ===\n');

  // Get pending transcripts
  const { data: transcripts, error } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, transcription_text, attendees, deal_id, company_id, word_count')
    .is('analysis', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transcripts:', error);
    return;
  }

  console.log('Found', transcripts.length, 'pending transcripts\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const transcript of transcripts) {
    console.log('Processing:', transcript.title);
    console.log('  Words:', transcript.word_count);

    // Skip if too short
    if (!transcript.transcription_text || transcript.transcription_text.length < 100) {
      console.log('  SKIPPED: Transcript too short\n');
      skipCount++;
      continue;
    }

    try {
      const analysis = await analyzeMeeting(transcript.transcription_text, {
        title: transcript.title || 'Untitled Meeting',
        meetingDate: transcript.meeting_date || new Date().toISOString().split('T')[0],
        attendees: transcript.attendees || [],
      });

      // Update the transcript with analysis
      const { error: updateError } = await supabase
        .from('meeting_transcriptions')
        .update({
          analysis,
          analysis_generated_at: new Date().toISOString(),
          summary: analysis.summary || null,
          follow_up_email_draft: analysis.followUpEmail?.body || null,
        })
        .eq('id', transcript.id);

      if (updateError) {
        console.log('  ERROR saving:', updateError.message);
        errorCount++;
      } else {
        console.log('  SUCCESS: Sentiment=' + analysis.sentiment?.overall);
        console.log('           Signals=' + (analysis.buyingSignals?.length || 0) +
                    ', Actions=' + (analysis.actionItems?.length || 0));
        successCount++;
      }
    } catch (err) {
      console.log('  ERROR:', err.message);
      errorCount++;
    }

    console.log('');
  }

  console.log('=== Complete ===');
  console.log('Success:', successCount);
  console.log('Skipped:', skipCount);
  console.log('Errors:', errorCount);
}

main();
