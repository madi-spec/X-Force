export const ANALYSIS_PROMPT_VERSION = 'v1';

export const PRODUCTS = [
  'Voice Agent',
  'Call Analytics',
  'Action Hub',
  'Performance Center',
  'Accountability Hub',
];

export const COMMUNICATION_TYPES = [
  'sales',
  'onboarding',
  'support',
  'success',
  'billing',
  'internal',
];

export function buildAnalysisPrompt(communication: {
  channel: string;
  direction: string;
  subject: string | null;
  content: string | null;
  participants: { our: string[]; their: string[] };
}): string {
  return `
Analyze this ${communication.channel} communication and extract structured intelligence.

COMMUNICATION:
Channel: ${communication.channel}
Direction: ${communication.direction}
Subject: ${communication.subject || 'N/A'}
Our participants: ${communication.participants.our.join(', ') || 'Unknown'}
Their participants: ${communication.participants.their.join(', ') || 'Unknown'}

Content:
${communication.content || '[No content]'}

INSTRUCTIONS:
Extract the following with confidence scores (0.0-1.0). Only include items you're confident about.

1. SUMMARY: 1-2 sentence summary of the communication

2. COMMUNICATION_TYPE: One of: ${COMMUNICATION_TYPES.join(', ')}

3. PRODUCTS_DISCUSSED: Which products mentioned: ${PRODUCTS.join(', ')}

4. SENTIMENT:
   - sentiment: positive, neutral, negative, concerned, excited
   - score: -1.0 (very negative) to 1.0 (very positive)
   - confidence: 0.0-1.0

5. FACTS_LEARNED: New facts about the company/contact
   [{ "fact": "string", "confidence": 0.0-1.0, "quote": "source text" }]

6. SIGNALS: Buying signals or risk signals
   [{ "signal": "budget_confirmed|timeline_urgent|competitor_evaluating|deal_at_risk|ready_to_proceed|etc",
      "detail": "string", "confidence": 0.0-1.0 }]

7. OBJECTIONS: Concerns or objections raised
   [{ "objection": "string", "detail": "string", "confidence": 0.0-1.0, "addressed": false }]

8. COMMITMENTS_US: Promises/commitments WE made (X-RAI team)
   [{ "commitment": "string", "confidence": 0.0-1.0, "due_by": "YYYY-MM-DD or null", "owner": "name or null" }]

9. COMMITMENTS_THEM: Promises/commitments THEY made (customer/prospect)
   [{ "commitment": "string", "confidence": 0.0-1.0, "due_by": "YYYY-MM-DD or null", "who": "name or null" }]

10. COMPETITORS: Competitors mentioned
    [{ "competitor": "string", "context": "currently using|evaluating|mentioned", "confidence": 0.0-1.0 }]

11. NEXT_STEPS: Identified next actions
    [{ "step": "string", "owner": "us|them", "priority": "high|medium|low", "confidence": 0.0-1.0 }]

12. POTENTIAL_TRIGGERS: What Command Center actions might this trigger?
    Choose from: inbound_inquiry, demo_request, pricing_request, commitment_made, commitment_due,
    competitor_mentioned, objection_raised, deal_at_risk, follow_up_needed, question_asked,
    positive_signal, negative_signal, escalation_needed, none

Return as array: ["trigger1", "trigger2"]

RESPONSE FORMAT:
Return valid JSON matching this schema:
{
  "summary": "string",
  "communication_type": "string",
  "products_discussed": ["string"],
  "sentiment": { "sentiment": "string", "score": number, "confidence": number },
  "extracted_facts": [...],
  "extracted_signals": [...],
  "extracted_objections": [...],
  "extracted_commitments_us": [...],
  "extracted_commitments_them": [...],
  "extracted_competitors": [...],
  "extracted_next_steps": [...],
  "potential_triggers": ["string"]
}

Be conservative with confidence scores. Only high confidence (>0.85) items should trigger actions.
If unsure about something, either omit it or give it a low confidence score.
`;
}
