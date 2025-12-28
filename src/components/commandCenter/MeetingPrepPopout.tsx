'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  X,
  Calendar,
  Clock,
  Users,
  Target,
  MessageSquare,
  AlertTriangle,
  HelpCircle,
  FileText,
  Video,
  Loader2,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Building2,
  Briefcase,
  User,
  CheckCircle,
  CircleDot,
  Flag,
  Lightbulb,
  Zap,
  Heart,
} from 'lucide-react';
import { TimeBlock, MeetingWithPrep, MeetingAttendee, ContextAwareMeetingPrep } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface MeetingPrepPopoutProps {
  meeting: TimeBlock;
  onClose: () => void;
  className?: string;
}

// ============================================
// HELPERS
// ============================================

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
}

function getRoleBadgeColor(role?: MeetingAttendee['role']): string {
  switch (role) {
    case 'decision_maker':
      return 'bg-purple-100 text-purple-700';
    case 'champion':
      return 'bg-green-100 text-green-700';
    case 'influencer':
      return 'bg-blue-100 text-blue-700';
    case 'blocker':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getRoleLabel(role?: MeetingAttendee['role']): string {
  switch (role) {
    case 'decision_maker':
      return 'Decision Maker';
    case 'champion':
      return 'Champion';
    case 'influencer':
      return 'Influencer';
    case 'blocker':
      return 'Blocker';
    default:
      return 'Unknown Role';
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MeetingPrepPopout({
  meeting,
  onClose,
  className,
}: MeetingPrepPopoutProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prep, setPrep] = useState<MeetingWithPrep | null>(null);

  // Fetch meeting prep
  useEffect(() => {
    async function fetchPrep() {
      if (!meeting.meeting_id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/calendar/${meeting.meeting_id}/prep`);
        const data = await response.json();

        if (!response.ok) {
          // Provide a more helpful message for 404
          if (response.status === 404) {
            throw new Error('Meeting prep not available yet. This meeting hasn\'t been synced to activities.');
          }
          throw new Error(data.error || 'Failed to load meeting prep');
        }

        setPrep(data);
      } catch (err) {
        console.error('[MeetingPrep] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load prep');
      } finally {
        setLoading(false);
      }
    }

    fetchPrep();
  }, [meeting.meeting_id]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 flex flex-col',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-medium text-gray-900">Meeting Prep</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Meeting Info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-medium text-gray-900">
                    {meeting.meeting_title || 'Meeting'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {formatTimeRange(meeting.start, meeting.end)}
                    <span className="text-gray-300">·</span>
                    {meeting.duration_minutes} min
                  </p>
                </div>
                {prep?.has_rich_context && (
                  <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Rich Context
                  </span>
                )}
              </div>

              {/* Context-Aware Prep: Quick Context */}
              {prep?.context_aware_prep?.quick_context && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-xl">
                  <p className="text-gray-800 leading-relaxed">
                    {prep.context_aware_prep.quick_context}
                  </p>
                </div>
              )}

              {/* Context-Aware Prep: Relationship Status */}
              {prep?.context_aware_prep?.relationship_status && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Relationship Status
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {prep.context_aware_prep.relationship_status.deal_name && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Deal</p>
                        <p className="font-medium text-gray-900 truncate">{prep.context_aware_prep.relationship_status.deal_name}</p>
                      </div>
                    )}
                    {prep.context_aware_prep.relationship_status.deal_stage && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Stage</p>
                        <p className="font-medium text-gray-900 capitalize">{prep.context_aware_prep.relationship_status.deal_stage.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {prep.context_aware_prep.relationship_status.deal_value && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Value</p>
                        <p className="font-medium text-green-600">{formatValue(prep.context_aware_prep.relationship_status.deal_value)}</p>
                      </div>
                    )}
                    {prep.context_aware_prep.relationship_status.sentiment && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Sentiment</p>
                        <p className="font-medium text-gray-900 capitalize">{prep.context_aware_prep.relationship_status.sentiment}</p>
                      </div>
                    )}
                    {prep.context_aware_prep.relationship_status.days_since_contact !== null && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Last Contact</p>
                        <p className="font-medium text-gray-900">{prep.context_aware_prep.relationship_status.days_since_contact} days ago</p>
                      </div>
                    )}
                    {prep.context_aware_prep.relationship_status.total_interactions > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Interactions</p>
                        <p className="font-medium text-gray-900">{prep.context_aware_prep.relationship_status.total_interactions} total</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Context-Aware Prep: Open Items */}
              {prep?.context_aware_prep?.open_items && (
                (prep.context_aware_prep.open_items.our_commitments_due.length > 0 ||
                 prep.context_aware_prep.open_items.their_commitments_pending.length > 0 ||
                 prep.context_aware_prep.open_items.unresolved_concerns.length > 0) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Open Items
                  </h4>
                  <div className="space-y-3">
                    {prep.context_aware_prep.open_items.our_commitments_due.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Our Commitments Due
                        </p>
                        <ul className="space-y-1">
                          {prep.context_aware_prep.open_items.our_commitments_due.map((c, i) => (
                            <li key={i} className="text-sm text-amber-800">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prep.context_aware_prep.open_items.their_commitments_pending.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CircleDot className="h-3.5 w-3.5" />
                          Their Commitments Pending
                        </p>
                        <ul className="space-y-1">
                          {prep.context_aware_prep.open_items.their_commitments_pending.map((c, i) => (
                            <li key={i} className="text-sm text-blue-800">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prep.context_aware_prep.open_items.unresolved_concerns.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs font-medium text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Unresolved Concerns
                        </p>
                        <ul className="space-y-1">
                          {prep.context_aware_prep.open_items.unresolved_concerns.map((c, i) => (
                            <li key={i} className="text-sm text-red-800">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Context-Aware Prep: Talking Points */}
              {prep?.context_aware_prep?.talking_points && prep.context_aware_prep.talking_points.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Talking Points
                  </h4>
                  <ul className="space-y-2">
                    {prep.context_aware_prep.talking_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-700">
                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-purple-100 text-purple-600 rounded text-xs font-medium mt-0.5">
                          {i + 1}
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context-Aware Prep: Watch Out */}
              {prep?.context_aware_prep?.watch_out && prep.context_aware_prep.watch_out.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Watch Out For
                  </h4>
                  <ul className="list-disc ml-5 space-y-1 text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
                    {prep.context_aware_prep.watch_out.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context-Aware Prep: Suggested Goals */}
              {prep?.context_aware_prep?.suggested_goals && prep.context_aware_prep.suggested_goals.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Suggested Goals
                  </h4>
                  <ul className="space-y-2">
                    {prep.context_aware_prep.suggested_goals.map((goal, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-700">
                        <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context-Aware Prep: Personalization Notes */}
              {prep?.context_aware_prep?.personalization && (
                (prep.context_aware_prep.personalization.key_facts_to_reference.length > 0 ||
                 prep.context_aware_prep.personalization.communication_style) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Personalization Notes
                  </h4>
                  <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg space-y-2">
                    {prep.context_aware_prep.personalization.key_facts_to_reference.length > 0 && (
                      <div>
                        <p className="text-xs text-pink-600 uppercase tracking-wider mb-1">Key Facts to Reference</p>
                        <ul className="space-y-1">
                          {prep.context_aware_prep.personalization.key_facts_to_reference.map((f, i) => (
                            <li key={i} className="text-sm text-pink-800">• {f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prep.context_aware_prep.personalization.communication_style && (
                      <div>
                        <p className="text-xs text-pink-600 uppercase tracking-wider mb-1">Communication Style</p>
                        <p className="text-sm text-pink-800">{prep.context_aware_prep.personalization.communication_style}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Fallback: Basic Prep (when no context-aware prep) */}
              {!prep?.context_aware_prep && (
                <>
                  {/* Attendees */}
                  {prep?.attendees && prep.attendees.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Attendees
                      </h4>
                      <div className="space-y-2">
                        {prep.attendees.map((attendee, i) => (
                          <div
                            key={i}
                            className="p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">
                                  {attendee.name || attendee.email}
                                </span>
                              </div>
                              {attendee.role && attendee.role !== 'unknown' && (
                                <span className={cn(
                                  'px-2 py-0.5 text-xs font-medium rounded',
                                  getRoleBadgeColor(attendee.role)
                                )}>
                                  {getRoleLabel(attendee.role)}
                                </span>
                              )}
                            </div>
                            {attendee.title && (
                              <p className="text-sm text-gray-500 mt-1 ml-6">
                                {attendee.title}
                              </p>
                            )}
                            {attendee.relationship_notes && (
                              <p className="text-sm text-gray-600 mt-1 ml-6 italic">
                                {attendee.relationship_notes}
                              </p>
                            )}
                            {attendee.meeting_count && (
                              <p className="text-xs text-gray-400 mt-1 ml-6">
                                Met {attendee.meeting_count}x before
                                {attendee.last_met_at && ` · Last: ${new Date(attendee.last_met_at).toLocaleDateString()}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meeting Objective */}
                  {prep?.prep?.objective && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Meeting Objective
                      </h4>
                      <p className="text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                        {prep.prep.objective}
                      </p>
                    </div>
                  )}

                  {/* Talking Points */}
                  {prep?.prep?.talking_points && prep.prep.talking_points.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Talking Points
                      </h4>
                      <ul className="list-disc ml-5 space-y-1 text-gray-700">
                        {prep.prep.talking_points.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Landmines */}
                  {prep?.prep?.landmines && prep.prep.landmines.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Topics to Avoid
                      </h4>
                      <ul className="list-disc ml-5 space-y-1 text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
                        {prep.prep.landmines.map((landmine, i) => (
                          <li key={i}>{landmine}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Questions to Ask */}
                  {prep?.prep?.questions_to_ask && prep.prep.questions_to_ask.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Questions to Ask
                      </h4>
                      <ul className="list-disc ml-5 space-y-1 text-gray-700">
                        {prep.prep.questions_to_ask.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Deal Context (shown for both basic and context-aware prep) */}
              {prep?.deal_name && !prep?.context_aware_prep && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Deal Context
                  </h4>
                  <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-gray-900">{prep.deal_name}</span>
                      </div>
                      {prep.deal_value && (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <DollarSign className="h-4 w-4" />
                          {formatValue(prep.deal_value)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                      {prep.deal_stage && (
                        <span className="capitalize">{prep.deal_stage.replace(/_/g, ' ')}</span>
                      )}
                      {prep.deal_health !== undefined && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Health: {prep.deal_health}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Prep Materials */}
              {prep?.prep_materials && prep.prep_materials.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Prep Materials
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {prep.prep_materials.map((material, i) => (
                      <Link
                        key={i}
                        href={material.url}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {material.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
          {/* Join Meeting button would go here if we have the URL */}
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            onClick={() => {
              // In production, this would open the meeting URL
              alert('Join meeting functionality coming soon');
            }}
          >
            <Video className="h-4 w-4" />
            Join Meeting
          </button>
        </div>
      </div>
    </>
  );
}
