'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Video,
  Clock,
  Users,
  ChevronRight,
  ChevronDown,
  EyeOff,
  Eye,
  Building2,
  FileText,
  ClipboardList,
} from 'lucide-react';
import type { MeetingFromActivity } from '../data';

interface Customer {
  id: string;
  name: string;
}

interface MeetingPrepCardProps {
  meeting: MeetingFromActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onExclude: () => void;
  onRestore?: () => void;
  customers: Customer[];
  onAssignCustomer: (customerId: string | null) => void;
  CustomerDropdown: React.ComponentType<{
    customerId: string | null;
    customerName: string | null;
    onAssign: (customerId: string | null) => void;
    customers: Customer[];
  }>;
}

export function MeetingPrepCard({
  meeting,
  isExpanded,
  onToggle,
  onExclude,
  onRestore,
  customers,
  onAssignCustomer,
  CustomerDropdown,
}: MeetingPrepCardProps) {
  const isExcluded = meeting.excluded_at !== null;
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDuration = () => {
    if (meeting.duration_minutes) {
      const minutes = meeting.duration_minutes;
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
      return `${minutes}m`;
    }
    return '30m'; // Default
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{meeting.subject}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 flex-wrap">
              <CustomerDropdown
                customerId={meeting.company_id}
                customerName={meeting.company_name}
                onAssign={onAssignCustomer}
                customers={customers}
              />
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(meeting.occurred_at)} · {getDuration()}
              </span>
              {meeting.attendee_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {meeting.attendee_count}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {meeting.join_url && (
            <a
              href={meeting.join_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Video className="w-4 h-4" />
              Join
            </a>
          )}
          <Link
            href={`/meetings/${meeting.external_id || meeting.id}/prep`}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ClipboardList className="w-4 h-4" />
            Meeting Prep
          </Link>
          {isExcluded && onRestore ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="p-2 hover:bg-green-100 rounded-lg transition-colors text-green-600 hover:text-green-700"
              title="Restore meeting"
            >
              <Eye className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExclude();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              title="Exclude meeting"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4">
          <div className="space-y-3">
            {/* Company Info */}
            {meeting.company_name ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span>{meeting.company_name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                <Building2 className="w-4 h-4" />
                <span>No company assigned - click the company field above to assign</span>
              </div>
            )}

            {/* Notes indicator */}
            {meeting.hasNotes && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>Meeting notes available</span>
              </div>
            )}

            {/* Contact */}
            {meeting.contact_name && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-gray-400" />
                <span>Primary contact: {meeting.contact_name}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
