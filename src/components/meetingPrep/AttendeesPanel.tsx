'use client';

import { User, Mail, Briefcase } from 'lucide-react';
import type { MeetingAttendee } from '@/types/commandCenter';

interface AttendeesPanelProps {
  attendees: MeetingAttendee[];
}

const ROLE_COLORS: Record<string, string> = {
  decision_maker: 'bg-purple-50 text-purple-700 border-purple-200',
  influencer: 'bg-blue-50 text-blue-700 border-blue-200',
  user: 'bg-green-50 text-green-700 border-green-200',
  technical: 'bg-amber-50 text-amber-700 border-amber-200',
  unknown: 'bg-gray-50 text-gray-600 border-gray-200',
};

const ROLE_LABELS: Record<string, string> = {
  decision_maker: 'Decision Maker',
  influencer: 'Influencer',
  user: 'User',
  technical: 'Technical',
  unknown: 'Contact',
};

export function AttendeesPanel({ attendees }: AttendeesPanelProps) {
  if (attendees.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Attendees
        </h2>
        <p className="text-sm text-gray-400">No attendees found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
        Attendees ({attendees.length})
      </h2>

      <div className="space-y-3">
        {attendees.map((attendee, idx) => (
          <div
            key={attendee.email || idx}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            {/* Avatar */}
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm truncate">
                  {attendee.name || attendee.email?.split('@')[0] || 'Unknown'}
                </span>
                {attendee.role && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      ROLE_COLORS[attendee.role] || ROLE_COLORS.unknown
                    }`}
                  >
                    {ROLE_LABELS[attendee.role] || attendee.role}
                  </span>
                )}
              </div>

              {attendee.title && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                  <Briefcase className="h-3 w-3" />
                  <span className="truncate">{attendee.title}</span>
                </div>
              )}

              {attendee.email && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{attendee.email}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
