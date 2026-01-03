import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
import { getPromptWithVariables } from '@/lib/ai/promptManager';
import { buildAnalysisPrompt, ANALYSIS_PROMPT_VERSION } from './prompts/v1';
import { cleanEmailContent } from '@/lib/email/contentCleaner';
import type { Communication } from '@/types/communicationHub';

// Expected AI response structure
interface AnalysisResult {
  summary: string;
  communication_type: string;
  products_discussed: string[];
  sentiment: {
    sentiment: string;
    score: number;
    confidence: number;
  };
  extracted_facts: Array<{
    fact: string;
    confidence: number;
    quote?: string;
  }>;
  extracted_signals: Array<{
    signal: string;
    detail: string;
    confidence: number;
  }>;
  extracted_objections: Array<{
    objection: string;
    detail: string;
    confidence: number;
    addressed: boolean;
  }>;
  extracted_commitments_us: Array<{
    commitment: string;
    confidence: number;
    due_by?: string | null;
    owner?: string | null;
  }>;
  extracted_commitments_them: Array<{
    commitment: string;
    confidence: number;
    due_by?: string | null;
    who?: string | null;
  }>;
  extracted_competitors: Array<{
    competitor: string;
    context: string;
    confidence: number;
  }>;
  extracted_next_steps: Array<{
    step: string;
    owner: 'us' | 'them';
    priority: 'high' | 'medium' | 'low';
    confidence: number;
  }>;
  potential_triggers: string[];
}

const ANALYSIS_SCHEMA = `{
  "summary": "string - 1-2 sentence summary",
  "communication_type": "sales|onboarding|support|success|billing|internal",
  "products_discussed": ["array of product names"],
  "sentiment": { "sentiment": "positive|neutral|negative|concerned|excited", "score": -1.0 to 1.0, "confidence": 0.0 to 1.0 },
  "extracted_facts": [{ "fact": "string", "confidence": 0.0-1.0, "quote": "optional source text" }],
  "extracted_signals": [{ "signal": "string", "detail": "string", "confidence": 0.0-1.0 }],
  "extracted_objections": [{ "objection": "string", "detail": "string", "confidence": 0.0-1.0, "addressed": false }],
  "extracted_commitments_us": [{ "commitment": "string", "confidence": 0.0-1.0, "due_by": "YYYY-MM-DD or null", "owner": "name or null" }],
  "extracted_commitments_them": [{ "commitment": "string", "confidence": 0.0-1.0, "due_by": "YYYY-MM-DD or null", "who": "name or null" }],
  "extracted_competitors": [{ "competitor": "string", "context": "currently using|evaluating|mentioned", "confidence": 0.0-1.0 }],
  "extracted_next_steps": [{ "step": "string", "owner": "us|them", "priority": "high|medium|low", "confidence": 0.0-1.0 }],
  "potential_triggers": ["array of trigger types"]
}`;

export async function analyzeCommunication(
  communicationId: string
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  const supabase = createAdminClient();

  // Fetch communication
  const { data: comm, error: fetchError } = await supabase
    .from('communications')
    .select('*')
    .eq('id', communicationId)
    .single();

  if (fetchError || !comm) {
    return { success: false, error: `Communication not found: ${communicationId}` };
  }

  // Skip if no content to analyze
  if (!comm.full_content && !comm.content_preview && !comm.subject) {
    // Mark as complete with no analysis needed
    await supabase
      .from('communications')
      .update({ analysis_status: 'complete' })
      .eq('id', communicationId);
    return { success: true, analysisId: undefined };
  }

  // Mark as processing
  await supabase
    .from('communications')
    .update({ analysis_status: 'processing' })
    .eq('id', communicationId);

  try {
    // Build prompt with cleaned content (removes boilerplate security headers/footers)
    const rawContent = comm.full_content || comm.content_preview || '';
    const cleanedContent = comm.channel === 'email' ? cleanEmailContent(rawContent) : rawContent;

    // Prepare participants text
    const ourParticipants = (comm.our_participants || []).map((p: { name?: string; email?: string }) => p.name || p.email).filter(Boolean) as string[];
    const theirParticipants = (comm.their_participants || []).map((p: { name?: string; email?: string }) => p.name || p.email).filter(Boolean) as string[];

    // Try to load the managed prompt from database
    const promptResult = await getPromptWithVariables('communication_hub_analysis', {
      channel: comm.channel || 'email',
      direction: comm.direction || 'inbound',
      subject: comm.subject || '',
      content: cleanedContent,
      ourParticipants: ourParticipants.join(', ') || 'Unknown',
      theirParticipants: theirParticipants.join(', ') || 'Unknown',
    });

    // Use managed prompt or fall back to buildAnalysisPrompt
    let prompt: string;
    if (promptResult?.prompt) {
      prompt = promptResult.prompt;
    } else {
      console.warn('[analyzeCommunication] Failed to load communication_hub_analysis prompt, using fallback');
      prompt = buildAnalysisPrompt({
        channel: comm.channel,
        direction: comm.direction,
        subject: comm.subject,
        content: cleanedContent,
        participants: {
          our: ourParticipants,
          their: theirParticipants,
        },
      });
    }

    // Call AI using existing client
    const { data: result } = await callAIJson<AnalysisResult>({
      prompt,
      schema: promptResult?.schema || ANALYSIS_SCHEMA,
      model: (promptResult?.model as 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514') || 'claude-sonnet-4-20250514',
      maxTokens: promptResult?.maxTokens || 2000,
    });

    // Ensure arrays have defaults
    const safeResult: AnalysisResult = {
      summary: result.summary || '',
      communication_type: result.communication_type || 'sales',
      products_discussed: result.products_discussed || [],
      sentiment: result.sentiment || { sentiment: 'neutral', score: 0, confidence: 0.5 },
      extracted_facts: result.extracted_facts || [],
      extracted_signals: result.extracted_signals || [],
      extracted_objections: result.extracted_objections || [],
      extracted_commitments_us: result.extracted_commitments_us || [],
      extracted_commitments_them: result.extracted_commitments_them || [],
      extracted_competitors: result.extracted_competitors || [],
      extracted_next_steps: result.extracted_next_steps || [],
      potential_triggers: result.potential_triggers || [],
    };

    // Get current version number
    const { data: existingAnalyses } = await supabase
      .from('communication_analysis')
      .select('version')
      .eq('communication_id', communicationId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existingAnalyses?.[0]?.version || 0) + 1;

    // Mark old analyses as not current
    await supabase
      .from('communication_analysis')
      .update({ is_current: false })
      .eq('communication_id', communicationId);

    // Insert new analysis
    const { data: analysis, error: insertError } = await supabase
      .from('communication_analysis')
      .insert({
        communication_id: communicationId,
        version: nextVersion,
        is_current: true,
        model_used: 'claude-3-haiku-20240307',
        prompt_version: ANALYSIS_PROMPT_VERSION,
        summary: safeResult.summary,
        communication_type: safeResult.communication_type,
        products_discussed: safeResult.products_discussed,
        sentiment: safeResult.sentiment.sentiment,
        sentiment_score: safeResult.sentiment.score,
        sentiment_confidence: safeResult.sentiment.confidence,
        extracted_facts: safeResult.extracted_facts,
        extracted_signals: safeResult.extracted_signals,
        extracted_objections: safeResult.extracted_objections,
        extracted_commitments_us: safeResult.extracted_commitments_us,
        extracted_commitments_them: safeResult.extracted_commitments_them,
        extracted_competitors: safeResult.extracted_competitors,
        extracted_next_steps: safeResult.extracted_next_steps,
        potential_triggers: safeResult.potential_triggers,
        analyzed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    // Update communication with analysis reference
    await supabase
      .from('communications')
      .update({
        analysis_status: 'complete',
        current_analysis_id: analysis.id,
      })
      .eq('id', communicationId);

    // Extract promises
    await extractPromises(communicationId, analysis.id, safeResult, comm, supabase);

    console.log(`[Analysis] Completed for communication ${communicationId}`);
    return { success: true, analysisId: analysis.id };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Analysis] Failed for ${communicationId}:`, error);

    await supabase
      .from('communications')
      .update({ analysis_status: 'failed' })
      .eq('id', communicationId);

    return { success: false, error: errorMessage };
  }
}

async function extractPromises(
  communicationId: string,
  analysisId: string,
  result: AnalysisResult,
  comm: Communication,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  const promises: Array<{
    direction: string;
    promise_text: string;
    company_id: string | null;
    contact_id: string | null;
    deal_id: string | null;
    owner_user_id?: string | null;
    owner_name?: string | null;
    promiser_name?: string | null;
    promised_at: string;
    due_by: string | null;
    status: string;
    source_communication_id: string;
    source_analysis_id: string;
    confidence: number;
  }> = [];

  // Our commitments
  for (const commitment of result.extracted_commitments_us) {
    if (commitment.confidence < 0.7) continue; // Skip low confidence

    promises.push({
      direction: 'we_promised',
      promise_text: commitment.commitment,
      company_id: comm.company_id,
      contact_id: comm.contact_id,
      deal_id: comm.deal_id,
      owner_user_id: comm.user_id,
      owner_name: commitment.owner || null,
      promised_at: comm.occurred_at,
      due_by: commitment.due_by || null,
      status: 'pending',
      source_communication_id: communicationId,
      source_analysis_id: analysisId,
      confidence: commitment.confidence,
    });
  }

  // Their commitments
  for (const commitment of result.extracted_commitments_them) {
    if (commitment.confidence < 0.7) continue; // Skip low confidence

    promises.push({
      direction: 'they_promised',
      promise_text: commitment.commitment,
      company_id: comm.company_id,
      contact_id: comm.contact_id,
      deal_id: comm.deal_id,
      promiser_name: commitment.who || null,
      promised_at: comm.occurred_at,
      due_by: commitment.due_by || null,
      status: 'pending',
      source_communication_id: communicationId,
      source_analysis_id: analysisId,
      confidence: commitment.confidence,
    });
  }

  if (promises.length > 0) {
    const { error } = await supabase.from('promises').insert(promises);
    if (error) {
      console.error(`[Analysis] Failed to insert promises:`, error);
    } else {
      console.log(`[Analysis] Extracted ${promises.length} promises`);
    }
  }
}

export async function analyzeAllPending(
  options?: { limit?: number }
): Promise<{ analyzed: number; errors: number }> {
  const supabase = createAdminClient();

  const { data: pending, error } = await supabase
    .from('communications')
    .select('id')
    .eq('analysis_status', 'pending')
    .order('occurred_at', { ascending: false })
    .limit(options?.limit || 50);

  if (error || !pending) {
    console.error('[Analysis] Failed to fetch pending:', error);
    return { analyzed: 0, errors: 1 };
  }

  console.log(`[Analysis] Found ${pending.length} pending communications`);

  let analyzed = 0;
  let errors = 0;

  for (const comm of pending) {
    const result = await analyzeCommunication(comm.id);
    if (result.success) {
      analyzed++;
    } else {
      errors++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { analyzed, errors };
}
