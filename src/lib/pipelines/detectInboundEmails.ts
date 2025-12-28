/**
 * Pipeline 2: Detect Inbound Emails
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  🚫 DEPRECATED - THIS FILE SHOULD NOT BE USED DIRECTLY                       ║
 * ║                                                                              ║
 * ║  The original implementation used KEYWORD MATCHING which is FORBIDDEN.       ║
 * ║  See /docs/X-FORCE-ARCHITECTURAL-RULES.md                                    ║
 * ║                                                                              ║
 * ║  ✅ CORRECT: Use processUnanalyzedEmails from @/lib/email instead            ║
 * ║     - AI analyzes emails and determines communicationType                    ║
 * ║     - COMMUNICATION_TYPE_TIERS maps communicationType to tier                ║
 * ║     - NO keyword matching                                                    ║
 * ║                                                                              ║
 * ║  This stub exists only for backward compatibility.                           ║
 * ║  It redirects to the correct AI-based implementation.                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @deprecated Use processUnanalyzedEmails from @/lib/email instead
 */

import { processUnanalyzedEmails } from '@/lib/email';

interface PipelineResult {
  messagesProcessed: number;
  itemsCreated: number;
  byTrigger: Record<string, number>;
  errors: string[];
}

/**
 * @deprecated This function is deprecated. Use processUnanalyzedEmails from @/lib/email instead.
 *
 * The original implementation used keyword matching which violates architectural rules.
 * This stub now redirects to the AI-based email processing pipeline.
 */
export async function detectInboundEmails(userId?: string): Promise<PipelineResult> {
  console.warn(
    '[DEPRECATED] detectInboundEmails uses keyword matching. ' +
    'Use processUnanalyzedEmails from @/lib/email instead.'
  );

  // Redirect to the correct AI-based implementation
  const result = await processUnanalyzedEmails(userId, 50);

  return {
    messagesProcessed: result.processed,
    itemsCreated: result.itemsCreated,
    byTrigger: { ai_analysis: result.itemsCreated },
    errors: result.errors,
  };
}

export default detectInboundEmails;
