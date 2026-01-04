import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import type { MeetingAnalysis } from '@/types';
import { getPromptWithProcessFallback } from './promptManager';
import { SALES_PLAYBOOK } from '@/lib/intelligence/salesPlaybook';
import { getProcessTypeForContext, type ProcessType } from '@/lib/process/getProcessContext';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalysisContext {
  title: string;
  meetingDate: string;
  attendees?: string[];
  dealId?: string;
  companyId?: string;
  userId?: string;
  processTypeOverride?: ProcessType;
}

interface DealContext {
  name: string;
  stage: string;
  estimatedValue: number;
  salesTeam: string | null;
  companyName: string;
  companySegment: string;
  companyIndustry: string;
}

interface CompanyContext {
  name: string;
  status: string;
  segment: string;
  industry: string;
  agentCount: number;
  crmPlatform: string | null;
  voiceCustomer: boolean;
}

export async function analyzeMeetingTranscription(
  transcriptionText: string,
  context: AnalysisContext
): Promise<MeetingAnalysis> {
  const startTime = Date.now();

  // Get additional context if deal/company provided
  let dealContext: DealContext | null = null;
  let companyContext: CompanyContext | null = null;

  if (context.dealId) {
    dealContext = await getDealContext(context.dealId);
  }

  if (context.companyId) {
    companyContext = await getCompanyContext(context.companyId);
  }

  const prompt = await buildAnalysisPrompt(
    transcriptionText,
    context,
    dealContext,
    companyContext
  );

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Parse the JSON response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    // Try to find raw JSON object
    const rawJsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (rawJsonMatch) {
      jsonText = rawJsonMatch[0];
    }
  }

  const analysis = JSON.parse(jsonText) as Omit<MeetingAnalysis, 'processingTime'>;

  const processingTime = Date.now() - startTime;

  return {
    ...analysis,
    processingTime,
  };
}

async function getDealContext(dealId: string): Promise<DealContext | null> {
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from('deals')
    .select(
      `
      name,
      stage,
      estimated_value,
      sales_team,
      company:companies(name, segment, industry)
    `
    )
    .eq('id', dealId)
    .single();

  if (!deal) return null;

  // Handle Supabase join which may return array or single object
  const companyData = deal.company;
  const company = Array.isArray(companyData)
    ? companyData[0] as { name: string; segment: string; industry: string } | undefined
    : companyData as { name: string; segment: string; industry: string } | null;

  return {
    name: deal.name,
    stage: deal.stage,
    estimatedValue: deal.estimated_value,
    salesTeam: deal.sales_team,
    companyName: company?.name || 'Unknown',
    companySegment: company?.segment || 'Unknown',
    companyIndustry: company?.industry || 'Unknown',
  };
}

async function getCompanyContext(companyId: string): Promise<CompanyContext | null> {
  const supabase = await createClient();

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (!company) return null;

  return {
    name: company.name,
    status: company.status,
    segment: company.segment,
    industry: company.industry,
    agentCount: company.agent_count,
    crmPlatform: company.crm_platform,
    voiceCustomer: company.voice_customer,
  };
}

async function buildAnalysisPrompt(
  transcription: string,
  context: AnalysisContext,
  dealContext: DealContext | null,
  companyContext: CompanyContext | null
): Promise<string> {
  let contextSection = '';

  if (dealContext) {
    contextSection += `
## Current Deal Context
- Deal Name: ${dealContext.name}
- Current Stage: ${dealContext.stage}
- Estimated Value: $${dealContext.estimatedValue.toLocaleString()}
- Sales Team: ${dealContext.salesTeam || 'Not assigned'}
- Company: ${dealContext.companyName}
- Segment: ${dealContext.companySegment}
- Industry: ${dealContext.companyIndustry}
`;
  }

  if (companyContext) {
    contextSection += `
## Company Context
- Name: ${companyContext.name}
- Status: ${companyContext.status}
- Segment: ${companyContext.segment}
- Industry: ${companyContext.industry}
- Agent Count: ${companyContext.agentCount}
- CRM Platform: ${companyContext.crmPlatform || 'Unknown'}
- Voice Customer: ${companyContext.voiceCustomer ? 'Yes' : 'No'}
`;
  }

  // Detect process type for this context
  let processType: ProcessType = 'sales';
  if (context.userId) {
    processType = context.processTypeOverride || await getProcessTypeForContext({
      userId: context.userId,
      companyId: context.companyId,
      meetingMetadata: context.processTypeOverride ? { process_type: context.processTypeOverride } : null,
    });
  }

  console.log(`[MeetingAnalysis] Using process type: ${processType}`);

  // Try to get the process-specific prompt from the database
  // Uses 'transcript_analysis' base key with process type suffix (e.g., 'transcript_analysis__onboarding')
  const dbPromptResult = await getPromptWithProcessFallback(
    'transcript_analysis',
    processType,
    {
      title: context.title,
      meetingDate: context.meetingDate,
      attendees: context.attendees?.join(', ') || 'Not specified',
      contextSection,
      transcription,
    }
  );

  if (dbPromptResult) {
    console.log(`[MeetingAnalysis] Using prompt: ${dbPromptResult.usedKey}`);
    return dbPromptResult.prompt;
  }

  // Fallback to hardcoded prompt if not in database
  return `${SALES_PLAYBOOK}

---

You are an expert sales analyst. Analyze this meeting transcription and extract actionable intelligence based on your understanding of our sales process above.

## Meeting Information
- Title: ${context.title}
- Date: ${context.meetingDate}
- Attendees: ${context.attendees?.join(', ') || 'Not specified'}
${contextSection}

## Transcription
${transcription}

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
      "role": "Their job role/title if mentioned or inferred",
      "email": "email@domain.com if explicitly mentioned, otherwise null",
      "sentiment": "positive|neutral|negative",
      "dealRole": "decision_maker|champion|influencer|end_user|blocker|null - infer from their authority and engagement",
      "confidence": 0.85,
      "keyQuotes": ["Notable things they said that reveal their position or concerns"],
      "personalFacts": [
        {
          "type": "personal|preference|family|interest|communication|concern",
          "fact": "Clear, concise statement about this person useful for relationship building",
          "quote": "Supporting quote from transcript if available"
        }
      ],
      "communicationInsights": {
        "preferredChannel": "email|phone|meeting|text if mentioned, otherwise null",
        "communicationTone": "formal|casual|technical - based on how they communicate"
      }
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
      "resolved": true or false
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
      "data": {"stage": "demo"}
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

Stakeholder Detection Guidelines:
- Extract ALL people mentioned from the prospect/customer organization
- For dealRole, use these definitions:
  - decision_maker: Has budget authority, final say on purchase decisions
  - champion: Internal advocate actively pushing for our solution
  - influencer: Can sway the decision, provides input but doesn't decide
  - end_user: Will use the product day-to-day, cares about usability
  - blocker: Resistant to change, expressing concerns or opposition
- For personalFacts, actively look for:
  - Family mentions (kids, spouse, pets, where they live)
  - Personal interests and hobbies (sports, activities, travel)
  - Work preferences (meeting times, communication style)
  - Background or career history mentions
  - Concerns beyond the business case
- Each personal fact should be actionable for relationship building
- Confidence should reflect how certain you are this person exists and their role (0.0 to 1.0)

Respond ONLY with the JSON object inside markdown code blocks, no other text.`;
}

export async function regenerateAnalysis(transcriptionId: string): Promise<MeetingAnalysis> {
  const supabase = await createClient();

  // Fetch the transcription
  const { data: transcription, error } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('id', transcriptionId)
    .single();

  if (error || !transcription) {
    throw new Error('Transcription not found');
  }

  // Re-analyze
  const analysis = await analyzeMeetingTranscription(transcription.transcription_text, {
    title: transcription.title,
    meetingDate: transcription.meeting_date,
    attendees: transcription.attendees || undefined,
    dealId: transcription.deal_id || undefined,
    companyId: transcription.company_id || undefined,
  });

  // Update the transcription with new analysis
  await supabase
    .from('meeting_transcriptions')
    .update({
      analysis,
      analysis_generated_at: new Date().toISOString(),
      summary: analysis.summary,
      follow_up_email_draft: analysis.followUpEmail.body,
    })
    .eq('id', transcriptionId);

  return analysis;
}
