import type { MeetingType } from '@/types/collateral';

/**
 * Infer meeting type from title and deal stage
 * Used to match appropriate collateral
 */
export function inferMeetingType(
  title: string,
  dealStage?: string | null
): MeetingType {
  const titleLower = title.toLowerCase();

  // Check title keywords first
  const titleMappings: [string[], MeetingType][] = [
    [['discovery', 'intro', 'introduction', 'learn more'], 'discovery'],
    [['demo', 'demonstration', 'show', 'walkthrough'], 'demo'],
    [['technical', 'integration', 'api', 'it review'], 'technical_deep_dive'],
    [['proposal', 'pricing', 'quote', 'investment'], 'proposal'],
    [['kickoff', 'onboarding', 'implementation', 'setup'], 'trial_kickoff'],
    [['check-in', 'check in', 'review', 'status'], 'check_in'],
    [['executive', 'leadership', 'c-level', 'ceo', 'coo'], 'executive'],
  ];

  for (const [keywords, meetingType] of titleMappings) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      return meetingType;
    }
  }

  // Fall back to deal stage
  if (dealStage) {
    const stageMappings: Record<string, MeetingType> = {
      'new_lead': 'discovery',
      'qualifying': 'discovery',
      'discovery': 'discovery',
      'demo': 'demo',
      'data_review': 'demo',
      'trial': 'check_in',
      'negotiation': 'proposal',
      'closed_won': 'implementation',
    };
    return stageMappings[dealStage] || 'discovery';
  }

  return 'discovery';
}

/**
 * Get a human-readable label for a meeting type
 */
export function getMeetingTypeLabel(meetingType: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    discovery: 'Discovery Call',
    demo: 'Demo',
    technical_deep_dive: 'Technical Deep Dive',
    proposal: 'Proposal Review',
    trial_kickoff: 'Trial Kickoff',
    implementation: 'Implementation',
    check_in: 'Check-in',
    executive: 'Executive Meeting',
  };

  return labels[meetingType] || meetingType;
}
