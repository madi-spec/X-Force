/**
 * SupportCase Projectors Module
 *
 * Exports all projectors and the SLA breach detector job.
 */

export { SupportCaseReadModelProjector } from './supportCaseReadModelProjector';
export { SupportCaseSlaFactsProjector } from './supportCaseSlaFactsProjector';
export { OpenCaseCountsProjector } from './openCaseCountsProjector';

export {
  detectSlaBreaches,
  runSlaBreachDetectorJob,
  type SlaBreachDetectorResult,
  type SlaBreachDetectorOptions,
} from './slaBreachDetector';

// Re-export for convenience
export const SUPPORT_CASE_PROJECTORS = [
  'support_case_read_model',
  'support_case_sla_facts',
  'company_product_open_case_counts',
] as const;
