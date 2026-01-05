'use client';

import { useState, useRef, useEffect } from 'react';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Clock,
  Users,
  Building2,
  Video,
  ClipboardList,
  MoreHorizontal,
  EyeOff,
  FileText,
  StickyNote,
  Sparkles,
  Undo2,
  Package,
} from 'lucide-react';

export interface TranscriptData {
  id: string;
  title: string;
  summary: string | null;
  analysis: {
    sentiment: string | null;
    buyingSignals: number;
    actionItems: number;
    headline: string | null;
    topics?: string[];
    nextSteps?: string[];
  } | null;
}

export interface Meeting {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  attendee_count: number;
  duration_minutes: number | null;
  join_url: string | null;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean;
  transcription_id: string | null;
  transcript: TranscriptData | null;
  needsCompanyAssignment: boolean;
  excluded_at: string | null;
  exclusion_reason: string | null;
}

export interface MeetingCardProps {
  meeting: Meeting;
  variant: 'upcoming' | 'past';
  onExclude: (meetingId: string, reason?: string) => Promise<void>;
  onRestore?: (meetingId: string) => Promise<void>;
  onAssignCompany: (meetingId: string) => void;
  onAddProduct?: (meetingId: string) => void;
  onOpenPrep: (meetingId: string) => void;
  onOpenTranscript?: (meetingId: string) => void;
  isExcluding?: boolean;
}

function formatMeetingTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a');
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}

export function MeetingCard({
  meeting,
  variant,
  onExclude,
  onRestore,
  onAssignCompany,
  onAddProduct,
  onOpenPrep,
  onOpenTranscript,
  isExcluding,
}: MeetingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isExcluded = !!meeting.excluded_at;
  const meetingDate = new Date(meeting.occurred_at);
  const isUpcoming = variant === 'upcoming';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Determine left border color
  const getBorderColor = () => {
    if (isExcluded) return 'border-l-gray-300';
    if (meeting.needsCompanyAssignment) return 'border-l-amber-400';
    if (isUpcoming && isToday(meetingDate)) return 'border-l-blue-500';
    return 'border-l-transparent';
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 border-l-2 rounded-r-lg transition-colors',
        getBorderColor(),
        isExcluded ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'
      )}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Subject line */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">
            {meeting.subject}
          </span>
          {/* Content indicators */}
          {variant === 'past' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {meeting.hasTranscript && (
                <FileText className="h-3 w-3 text-blue-500" />
              )}
              {meeting.hasNotes && (
                <StickyNote className="h-3 w-3 text-amber-500" />
              )}
              {meeting.hasAnalysis && (
                <Sparkles className="h-3 w-3 text-purple-500" />
              )}
            </div>
          )}
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
          {meeting.company_name ? (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{meeting.company_name}</span>
            </span>
          ) : (
            <button
              onClick={() => onAssignCompany(meeting.id)}
              className="text-amber-600 hover:text-amber-700 font-medium"
            >
              Unassigned
            </button>
          )}
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatMeetingTime(meeting.occurred_at)}
          </span>
          {meeting.duration_minutes && (
            <>
              <span className="text-gray-300">·</span>
              <span>{formatDuration(meeting.duration_minutes)}</span>
            </>
          )}
          {meeting.attendee_count > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {meeting.attendee_count}
              </span>
            </>
          )}
          {isExcluded && (
            <>
              <span className="text-gray-300">·</span>
              <span className="italic">Excluded</span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!isExcluded && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Add Product (past meetings with company) */}
          {variant === 'past' && meeting.company_id && onAddProduct && (
            <button
              onClick={() => onAddProduct(meeting.id)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Add Product"
            >
              <Package className="h-4 w-4" />
            </button>
          )}

          {/* AI Analysis button for past meetings with transcript - opens panel */}
          {variant === 'past' && meeting.hasTranscript && (
            <button
              onClick={() => onOpenTranscript?.(meeting.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              title="View AI Analysis"
            >
              <Sparkles className="h-4 w-4" />
              AI Analysis
            </button>
          )}

          {/* Join button for upcoming - FIRST */}
          {isUpcoming && meeting.join_url && (
            <a
              href={meeting.join_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Video className="h-4 w-4" />
              Join
            </a>
          )}

          {/* Meeting Prep button - after Join */}
          <button
            onClick={() => onOpenPrep(meeting.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            {isUpcoming ? 'Meeting Prep' : 'Notes'}
          </button>
        </div>
      )}

      {/* More menu */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          disabled={isExcluding}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
            {isExcluded ? (
              <button
                onClick={() => {
                  onRestore?.(meeting.id);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Restore
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    onAssignCompany(meeting.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {meeting.company_id ? 'Change Company' : 'Assign Company'}
                </button>
                <button
                  onClick={() => {
                    onExclude(meeting.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Exclude
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
