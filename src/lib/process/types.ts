/**
 * Process Studio Types
 *
 * Types for the unified Process Studio that manages playbooks across:
 * - Sales (Proven Process)
 * - Onboarding (Milestones)
 * - Support (Severity, SLA, Escalation)
 * - Engagement (Health stages, recommended plays)
 */

export type ProcessCategory = 'sales' | 'onboarding' | 'support' | 'engagement';

export interface ProcessCategoryConfig {
  id: ProcessCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  editorPath: (productSlug: string) => string;
  isImplemented: boolean;
}

export const PROCESS_CATEGORIES: ProcessCategoryConfig[] = [
  {
    id: 'sales',
    label: 'Sales Process',
    description: 'Proven process stages from lead to close',
    icon: 'Target',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    editorPath: (slug) => `/products/${slug}/process?process=sales`,
    isImplemented: true,
  },
  {
    id: 'onboarding',
    label: 'Onboarding Milestones',
    description: 'Customer activation and training journey',
    icon: 'Rocket',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    editorPath: (slug) => `/products/${slug}/process?process=onboarding`,
    isImplemented: true,
  },
  {
    id: 'support',
    label: 'Support Playbooks',
    description: 'Severity levels, SLAs, and escalation rules',
    icon: 'Ticket',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    editorPath: (slug) => `/products/${slug}/process?process=support`,
    isImplemented: true,
  },
  {
    id: 'engagement',
    label: 'Engagement Plays',
    description: 'Health-based actions and expansion triggers',
    icon: 'HeartHandshake',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    editorPath: (slug) => `/products/${slug}/process?process=engagement`,
    isImplemented: true,
  },
];

export function getProcessCategory(id: ProcessCategory): ProcessCategoryConfig | undefined {
  return PROCESS_CATEGORIES.find((c) => c.id === id);
}

// Product with process counts
export interface ProductWithProcesses {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  is_sellable: boolean;
  processes: {
    sales: ProcessSummary | null;
    onboarding: ProcessSummary | null;
    support: ProcessSummary | null;
    engagement: ProcessSummary | null;
  };
}

export interface ProcessSummary {
  id: string;
  name: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  stageCount: number;
  lastUpdated: string | null;
}

// Scaffold page types
export interface PlaybookStage {
  id: string;
  name: string;
  description: string | null;
  order: number;
  sla_days: number | null;
  is_terminal: boolean;
}

export interface OnboardingMilestone {
  id: string;
  name: string;
  description: string | null;
  order: number;
  target_days: number | null;
  required_tasks: string[];
  success_criteria: string[];
}

export interface SupportPlaybook {
  id: string;
  severity_level: 'critical' | 'high' | 'medium' | 'low';
  name: string;
  description: string | null;
  response_sla_hours: number;
  resolution_sla_hours: number;
  escalation_rules: EscalationRule[];
}

export interface EscalationRule {
  trigger: string;
  threshold_hours: number;
  notify: string[];
  action: string;
}

export interface EngagementPlay {
  id: string;
  name: string;
  description: string | null;
  health_trigger: {
    condition: 'above' | 'below' | 'between';
    threshold: number;
    secondary_threshold?: number;
  };
  recommended_actions: string[];
  automation_enabled: boolean;
}
