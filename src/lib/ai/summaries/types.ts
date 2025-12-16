/**
 * Summaries Engine Types
 * Types for AI-generated entity summaries
 */

// ============================================
// SUMMARY TYPES
// ============================================

export type SummaryType =
  | 'deal_overview'
  | 'deal_status'
  | 'company_overview'
  | 'contact_overview'
  | 'relationship_summary'
  | 'engagement_summary';

export type EntityType = 'deal' | 'company' | 'contact';

// ============================================
// DEAL SUMMARY
// ============================================

export interface DealSummary {
  // Core summary
  headline: string; // One-line summary
  overview: string; // 2-3 paragraph detailed summary

  // Current state
  currentStatus: {
    stage: string;
    daysInStage: number;
    healthScore: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  // Key information
  keyPoints: Array<{
    point: string;
    importance: 'high' | 'medium' | 'low';
  }>;

  // Stakeholders
  stakeholderStatus: {
    totalContacts: number;
    hasDecisionMaker: boolean;
    hasChampion: boolean;
    keyPlayers: Array<{
      name: string;
      role: string;
      sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
    }>;
  };

  // Engagement analysis
  engagement: {
    lastContactDate: string | null;
    daysSinceContact: number;
    recentActivityCount: number;
    communicationPattern: string;
  };

  // Risks and opportunities
  risks: string[];
  opportunities: string[];

  // Next steps
  recommendedActions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;

  // Metadata
  confidence: number; // 0-1
  generatedAt: string;
}

// ============================================
// COMPANY SUMMARY
// ============================================

export interface CompanySummary {
  // Core summary
  headline: string;
  overview: string;

  // Company profile
  profile: {
    status: string;
    segment: string;
    industry: string;
    size: string;
    crmPlatform: string | null;
    isVoiceCustomer: boolean;
  };

  // Relationship status
  relationship: {
    tenure: string | null;
    currentProducts: string[];
    totalRevenue: number | null;
    healthStatus: 'healthy' | 'at_risk' | 'churned' | 'prospect';
  };

  // Key contacts
  keyContacts: Array<{
    name: string;
    title: string | null;
    role: string | null;
    isPrimary: boolean;
  }>;

  // Active deals
  dealsSummary: {
    activeDeals: number;
    totalPipelineValue: number;
    closedWonValue: number;
    dealStages: Record<string, number>;
  };

  // Engagement history
  engagement: {
    totalActivities: number;
    lastActivityDate: string | null;
    activityTrend: 'increasing' | 'stable' | 'decreasing';
    primaryChannels: string[];
  };

  // Opportunities and risks
  opportunities: string[];
  risks: string[];

  // Recommendations
  recommendedActions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;

  // Metadata
  confidence: number;
  generatedAt: string;
}

// ============================================
// CONTACT SUMMARY
// ============================================

export interface ContactSummary {
  // Core summary
  headline: string;
  overview: string;

  // Contact profile
  profile: {
    name: string;
    title: string | null;
    role: string | null;
    company: string;
    email: string | null;
    phone: string | null;
  };

  // Influence and role
  influence: {
    decisionMakingRole: 'decision_maker' | 'influencer' | 'champion' | 'end_user' | 'blocker' | 'unknown';
    buyingInfluence: 'high' | 'medium' | 'low';
    sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
    engagementLevel: 'highly_engaged' | 'engaged' | 'passive' | 'disengaged';
  };

  // Communication style
  communication: {
    preferredChannel: 'email' | 'phone' | 'meeting' | 'unknown';
    responsePattern: string;
    bestTimeToReach: string | null;
  };

  // Engagement history
  engagement: {
    totalInteractions: number;
    lastContactDate: string | null;
    daysSinceContact: number;
    interactionTypes: Record<string, number>;
  };

  // Key insights
  keyInsights: Array<{
    insight: string;
    source: string;
  }>;

  // Pain points and interests
  painPoints: string[];
  interests: string[];

  // Relationship tips
  relationshipTips: string[];

  // Metadata
  confidence: number;
  generatedAt: string;
}

// ============================================
// DATABASE RECORD
// ============================================

export interface AISummaryRecord {
  id: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  summary_type: SummaryType;
  summary: DealSummary | CompanySummary | ContactSummary;
  summary_text: string | null;
  key_points: string[] | null;
  risks: string[] | null;
  opportunities: string[] | null;
  generated_at: string;
  context_hash: string | null;
  stale: boolean;
  model_used: string | null;
  tokens_used: number | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// SERVICE OPTIONS
// ============================================

export interface GenerateSummaryOptions {
  force?: boolean; // Force regeneration even if not stale
  includeHistory?: boolean; // Include full activity history
  maxActivities?: number; // Limit activities to analyze
}

export interface SummaryResult<T> {
  summary: T;
  isNew: boolean;
  wasStale: boolean;
  contextHash: string;
  tokensUsed: number;
  latencyMs: number;
}
