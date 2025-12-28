/**
 * Human Leverage System
 *
 * The killer feature: AI detects when human intervention is needed,
 * respects stop rules to avoid nagging, and generates actionable briefs.
 */

export { STOP_RULES, checkStopRules, type StopRuleCheck, type StopRuleContext } from './stopRules';

export {
  detectTriggers,
  getTriggerContext,
  type TriggerType,
  type TriggerResult,
  type TriggerContext,
  type UrgencyLevel,
  type RequiredRole,
} from './triggerDetection';

export { buildTrustBasis, updateTriggerAccuracy, type TrustBasis } from './trustBasis';

export { generateBrief, type HumanLeverageBrief } from './briefGenerator';
