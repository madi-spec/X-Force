// Product Types for Product-Centric CRM

export type ProductType = 'base' | 'suite' | 'module' | 'addon';

export type ProductStatus =
  | 'inactive'      // Not started
  | 'in_sales'      // Going through proven process
  | 'in_onboarding' // Sold, being implemented
  | 'active'        // Live customer
  | 'churned'       // Was active, now cancelled
  | 'declined';     // Was in sales, said no

export type CustomerType = 'prospect' | 'vfp_customer' | 'vft_customer';

export type ProspectingStage =
  | 'lead'
  | 'qualified'
  | 'demo_scheduled'
  | 'demo_complete'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_product_id: string | null;
  product_type: ProductType;
  display_order: number;
  icon: string | null;
  color: string | null;
  base_price_monthly: number | null;
  pricing_model: 'per_seat' | 'flat' | 'tiered' | null;
  is_active: boolean;
  is_sellable: boolean;
  created_at: string;
  updated_at: string;

  // Joined data
  parent_product?: Product;
  modules?: Product[];
  tiers?: ProductTier[];
  stages?: ProductSalesStage[];
}

export interface ProductTier {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  display_order: number;
  included_modules: string[] | null;
  features: Record<string, unknown> | null;
  price_monthly: number | null;
  created_at: string;
}

export interface ProductSalesStage {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  ai_sequence_id: string | null;
  ai_actions: Record<string, unknown> | null;
  pitch_points: PitchPoint[];
  objection_handlers: ObjectionHandler[];
  resources: Resource[];
  exit_criteria: string | null;
  exit_actions: Record<string, unknown> | null;
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PitchPoint {
  id: string;
  text: string;
  source?: 'manual' | 'ai_suggested';
  effectiveness_score?: number;
}

export interface ObjectionHandler {
  id: string;
  objection: string;
  response: string;
  source?: 'manual' | 'ai_suggested';
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'document' | 'video' | 'link';
}

// Risk level for company product pipeline health
export type CompanyProductRiskLevel = 'none' | 'low' | 'med' | 'high';

// Open objection tracked on a company product
export interface OpenObjection {
  objection: string;
  detected_at: string;
  severity: 'low' | 'medium' | 'high';
  source_communication_id?: string;
  addressed?: boolean;
}

export interface CompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
  status: ProductStatus;
  tier_id: string | null;
  seats: number | null;
  enabled_modules: string[];
  current_stage_id: string | null;
  stage_entered_at: string | null;
  ai_sequence_active: boolean;
  ai_sequence_paused_reason: string | null;
  sales_started_at: string | null;
  onboarding_started_at: string | null;
  activated_at: string | null;
  churned_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  owner_user_id: string | null;
  mrr: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Operating Layer Extensions
  last_stage_moved_at: string | null;
  last_human_touch_at: string | null;
  last_ai_touch_at: string | null;
  close_confidence: number | null; // 0-100
  close_ready: boolean;
  risk_level: CompanyProductRiskLevel | null;
  open_objections: OpenObjection[];
  next_step_due_at: string | null;

  // Joined data
  product?: Product;
  tier?: ProductTier;
  current_stage?: ProductSalesStage;
  company?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
}

export interface CompanyProductHistory {
  id: string;
  company_product_id: string;
  event_type: 'status_changed' | 'stage_changed' | 'tier_changed' | 'seats_changed' | 'note_added';
  from_value: string | null;
  to_value: string | null;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProspectingPipelineEntry {
  id: string;
  company_id: string;
  stage: ProspectingStage;
  interested_products: string[];
  owner_user_id: string | null;
  created_at: string;
  qualified_at: string | null;
  demo_at: string | null;
  proposal_sent_at: string | null;
  closed_at: string | null;
  outcome: 'won' | 'lost' | null;
  lost_reason: string | null;
  converted_to_customer_at: string | null;
  notes: string | null;
  updated_at: string;

  // Joined data
  company?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
}

// API Response Types
export interface ProductWithStats extends Product {
  stats: {
    active_count: number;
    in_sales_count: number;
    in_onboarding_count: number;
    inactive_count: number;
    declined_count: number;
    churned_count: number;
    total_mrr: number;
  };
  pipeline_by_stage: {
    stage_id: string;
    stage_name: string;
    count: number;
  }[];
}

// For the Products page
export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_sellable: boolean;
  stages: { id: string; name: string; stage_order: number }[];
  stats: {
    active: number;
    in_sales: number;
    in_onboarding: number;
    inactive: number;
    total_mrr: number;
  };
  pipelineByStage: Record<string, number>;
}

// ============================================
// Process View Types
// ============================================

export type ProcessType = 'sales' | 'onboarding' | 'customer_service' | 'engagement';
export type HealthStatus = 'healthy' | 'attention' | 'stalled';
export type ViewMode = 'all' | 'stage' | 'company';

export interface ProcessDefinition {
  id: ProcessType;
  name: string;
  icon: string;
  description: string;
}

export const PROCESSES: Record<ProcessType, ProcessDefinition> = {
  sales: {
    id: 'sales',
    name: 'Sales',
    icon: '🎯',
    description: 'Track prospects through your sales process',
  },
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding',
    icon: '🚀',
    description: 'Get new customers up and running',
  },
  customer_service: {
    id: 'customer_service',
    name: 'Customer Service',
    icon: '🛟',
    description: 'Handle customer issues and requests',
  },
  engagement: {
    id: 'engagement',
    name: 'Engagement',
    icon: '💚',
    description: 'Retention, upsells, and customer success',
  },
};

export interface PipelineItem {
  id: string;
  company_id: string;
  company_name: string;
  company_type: string | null;
  product_id: string;
  product_name: string;
  product_color: string | null;
  product_icon: string | null;
  status: string;
  current_stage_id: string | null;
  stage_name: string | null;
  stage_order: number | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_initials: string | null;
  mrr: number | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  last_stage_moved_at: string | null;
  days_in_stage: number;
  health_status: HealthStatus;
  health_reason: string | null;
}

export interface ProcessStats {
  total: number;
  needsAttention: number;
  stalled: number;
  healthy: number;
  totalMrr: number;
  productCount: number;
}

export interface StageDefinition {
  id: string;
  name: string;
  stage_order: number;
  product_id?: string;
  process_type?: string;
}

export interface ProcessViewResponse {
  items: PipelineItem[];
  stats: ProcessStats;
  stages: StageDefinition[];
}
