export type DocumentType =
  | 'one_pager'
  | 'case_study'
  | 'pricing'
  | 'proposal_template'
  | 'implementation_guide'
  | 'technical_doc'
  | 'demo_script'
  | 'roi_calculator'
  | 'contract'
  | 'presentation'
  | 'video'
  | 'other';

export type MeetingType =
  | 'discovery'
  | 'demo'
  | 'technical_deep_dive'
  | 'proposal'
  | 'trial_kickoff'
  | 'implementation'
  | 'check_in'
  | 'executive';

export type ProductTag =
  | 'voice_agent'
  | 'performance_center'
  | 'action_hub'
  | 'accountability_hub'
  | 'call_analytics'
  | 'platform';

export type IndustryTag =
  | 'pest_control'
  | 'lawn_care'
  | 'hvac'
  | 'plumbing'
  | 'general';

export type CompanySizeTag =
  | 'smb'
  | 'mid_market'
  | 'enterprise'
  | 'pe_platform';

export interface Collateral {
  id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string;
  file_size: number | null;
  thumbnail_path: string | null;
  external_url: string | null;
  document_type: DocumentType;
  meeting_types: MeetingType[];
  products: ProductTag[];
  industries: IndustryTag[];
  company_sizes: CompanySizeTag[];
  version: string;
  is_current: boolean;
  previous_version_id: string | null;
  view_count: number;
  share_count: number;
  last_used_at: string | null;
  visibility: 'team' | 'personal' | 'public';
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CollateralUsage {
  id: string;
  collateral_id: string;
  user_id: string;
  meeting_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  action: 'viewed' | 'downloaded' | 'shared' | 'copied_link';
  created_at: string;
}

export interface SoftwareLink {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  show_for_meeting_types: MeetingType[];
  show_for_products: ProductTag[];
  show_for_deal_stages: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingPrepNotes {
  id: string;
  meeting_id: string;
  user_id: string;
  deal_id: string | null;
  company_id: string | null;
  prep_notes: string | null;
  meeting_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollateralFilters {
  document_type?: DocumentType;
  meeting_type?: MeetingType;
  product?: ProductTag;
  industry?: IndustryTag;
  search?: string;
  include_archived?: boolean;
}

// Form input types for creating/updating collateral
export interface CollateralFormInput {
  name: string;
  description?: string;
  file_type: string;
  external_url?: string;
  document_type: DocumentType;
  meeting_types: MeetingType[];
  products: ProductTag[];
  industries: IndustryTag[];
  company_sizes: CompanySizeTag[];
  visibility?: 'team' | 'personal' | 'public';
}

// Labels for display
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  one_pager: 'One-Pager',
  case_study: 'Case Study',
  pricing: 'Pricing',
  proposal_template: 'Proposal Template',
  implementation_guide: 'Implementation Guide',
  technical_doc: 'Technical Doc',
  demo_script: 'Demo Script',
  roi_calculator: 'ROI Calculator',
  contract: 'Contract',
  presentation: 'Presentation',
  video: 'Video',
  other: 'Other',
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  technical_deep_dive: 'Technical Deep Dive',
  proposal: 'Proposal',
  trial_kickoff: 'Trial Kickoff',
  implementation: 'Implementation',
  check_in: 'Check-in',
  executive: 'Executive',
};

export const PRODUCT_TAG_LABELS: Record<ProductTag, string> = {
  voice_agent: 'Voice Agent',
  performance_center: 'Performance Center',
  action_hub: 'Action Hub',
  accountability_hub: 'Accountability Hub',
  call_analytics: 'Call Analytics',
  platform: 'Platform',
};

export const INDUSTRY_TAG_LABELS: Record<IndustryTag, string> = {
  pest_control: 'Pest Control',
  lawn_care: 'Lawn Care',
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  general: 'General',
};

export const COMPANY_SIZE_LABELS: Record<CompanySizeTag, string> = {
  smb: 'SMB',
  mid_market: 'Mid-Market',
  enterprise: 'Enterprise',
  pe_platform: 'PE Platform',
};
