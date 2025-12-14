export type ImportStep = 'upload' | 'mapping' | 'stages' | 'owners' | 'preview' | 'importing' | 'complete';
export type ImportType = 'deals' | 'companies' | 'contacts';

export interface ImportState {
  step: ImportStep;
  importType: ImportType;
  file: File | null;
  rawData: Record<string, string>[];
  columns: string[];
  sampleData: Record<string, string>[];
  columnMapping: Record<string, string>;
  stageMapping: Record<string, string>;
  ownerMapping: Record<string, string>;
  preview: ImportPreview;
  progress: ImportProgress;
  errors: ImportError[];
  results: ImportResults;
}

export interface ImportPreview {
  companies: number;
  newCompanies: number;
  matchedCompanies: number;
  contacts: number;
  deals: number;
  activities: number;
  skipped: number;
  skippedRows: Array<{ row: number; reason: string }>;
}

export interface ImportProgress {
  current: number;
  total: number;
  phase: 'companies' | 'contacts' | 'deals' | 'activities' | 'complete';
  recentActions: string[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResults {
  companies: number;
  contacts: number;
  deals: number;
  activities: number;
}

// Field mapping definitions
export const COMPANY_FIELDS = [
  { id: 'company_name', label: 'Company Name', required: true },
  { id: 'company_status', label: 'Company Status' },
  { id: 'segment', label: 'Segment' },
  { id: 'industry', label: 'Industry' },
  { id: 'agent_count', label: 'Agent Count' },
  { id: 'crm_platform', label: 'CRM Platform' },
  { id: 'address', label: 'Address' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'State' },
  { id: 'zip', label: 'Zip Code' },
  { id: 'voice_customer', label: 'Voice Customer' },
  { id: 'external_id', label: 'External ID' },
] as const;

export const CONTACT_FIELDS = [
  { id: 'contact_name', label: 'Contact Name' },
  { id: 'contact_email', label: 'Contact Email' },
  { id: 'contact_phone', label: 'Contact Phone' },
  { id: 'contact_title', label: 'Contact Title' },
  { id: 'contact_role', label: 'Contact Role' },
  { id: 'is_primary', label: 'Is Primary Contact' },
] as const;

export const DEAL_FIELDS = [
  { id: 'deal_name', label: 'Deal Name' },
  { id: 'deal_stage', label: 'Deal Stage' },
  { id: 'deal_type', label: 'Deal Type' },
  { id: 'deal_value', label: 'Deal Value' },
  { id: 'deal_owner', label: 'Deal Owner' },
  { id: 'sales_team', label: 'Sales Team' },
  { id: 'expected_close_date', label: 'Expected Close Date' },
  { id: 'created_date', label: 'Created Date' },
] as const;

export const ACTIVITY_FIELDS = [
  { id: 'activity_note', label: 'Activity Note' },
  { id: 'activity_date', label: 'Activity Date' },
] as const;

export const ALL_FIELDS = [
  ...COMPANY_FIELDS,
  ...CONTACT_FIELDS,
  ...DEAL_FIELDS,
  ...ACTIVITY_FIELDS,
  { id: 'skip', label: 'Skip this field' },
] as const;

// Auto-suggest mappings based on common column names
export const COLUMN_SUGGESTIONS: Record<string, string> = {
  // Company
  'company': 'company_name',
  'company name': 'company_name',
  'business': 'company_name',
  'business name': 'company_name',
  'organization': 'company_name',
  'account': 'company_name',
  'account name': 'company_name',
  'agents': 'agent_count',
  'agent count': 'agent_count',
  'number of agents': 'agent_count',
  'crm': 'crm_platform',
  'crm platform': 'crm_platform',
  'address': 'address',
  'street': 'address',
  'street address': 'address',
  'city': 'city',
  'state': 'state',
  'zip': 'zip',
  'zipcode': 'zip',
  'zip code': 'zip',
  'postal': 'zip',
  'postal code': 'zip',

  // Contact
  'contact': 'contact_name',
  'contact name': 'contact_name',
  'name': 'contact_name',
  'full name': 'contact_name',
  'email': 'contact_email',
  'contact email': 'contact_email',
  'email address': 'contact_email',
  'phone': 'contact_phone',
  'contact phone': 'contact_phone',
  'phone number': 'contact_phone',
  'mobile': 'contact_phone',
  'title': 'contact_title',
  'job title': 'contact_title',
  'position': 'contact_title',
  'role': 'contact_role',

  // Deal
  'deal': 'deal_name',
  'deal name': 'deal_name',
  'opportunity': 'deal_name',
  'opportunity name': 'deal_name',
  'stage': 'deal_stage',
  'deal stage': 'deal_stage',
  'pipeline stage': 'deal_stage',
  'status': 'deal_stage',
  'value': 'deal_value',
  'deal value': 'deal_value',
  'amount': 'deal_value',
  'deal amount': 'deal_value',
  'price': 'deal_value',
  'owner': 'deal_owner',
  'deal owner': 'deal_owner',
  'assigned to': 'deal_owner',
  'rep': 'deal_owner',
  'sales rep': 'deal_owner',
  'salesperson': 'deal_owner',
  'close date': 'expected_close_date',
  'expected close': 'expected_close_date',
  'expected close date': 'expected_close_date',
  'created': 'created_date',
  'created date': 'created_date',
  'created at': 'created_date',
  'date created': 'created_date',

  // Activity
  'notes': 'activity_note',
  'note': 'activity_note',
  'comments': 'activity_note',
  'description': 'activity_note',
  'last activity': 'activity_note',
  'activity': 'activity_note',
};
