'use client';

import { cn } from '@/lib/utils';
import { QueueItem, ACTION_VERB_STYLES } from '@/lib/work/types';
import { Clock, MessageSquare, User } from 'lucide-react';

/**
 * Clean context text by removing redundant prefixes like "X messages in thread -"
 */
function cleanContextText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove "N messages in thread - " prefix
  return text.replace(/^\d+\s+messages?\s+in\s+thread\s*[-–—:]\s*/i, '').trim();
}

interface WorkItemCardProps {
  item: QueueItem;
  isSelected?: boolean;
  onClick?: () => void;
}

/**
 * WorkItemCard - New Context→Action→Evidence format
 *
 * Structure:
 * - Header: Company + Stage badge
 * - Action: Verb pill + Context (urgency_reason)
 * - Metadata: Waiting time, thread count, contact name
 */
export function WorkItemCard({ item, isSelected, onClick }: WorkItemCardProps) {
  const actionStyle = ACTION_VERB_STYLES[item.action_verb];

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border cursor-pointer transition-all duration-200',
        'bg-white',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      )}
    >
      {/* Header: Company + Stage */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-900 truncate">
            {item.company_name}
          </span>
          {item.stage && (
            <span className="shrink-0 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {item.stage}
            </span>
          )}
        </div>
      </div>

      {/* Action + Context */}
      <div className="flex items-start gap-2 mb-3">
        <span
          className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded"
          style={{
            background: actionStyle.bg,
            color: actionStyle.text,
            border: `1px solid ${actionStyle.border}`,
          }}
        >
          {item.action_verb}
        </span>
        <span className="text-sm text-gray-600 line-clamp-2">
          {cleanContextText(item.urgency_reason || item.subtitle || item.title)}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {item.waiting_time && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Waiting {item.waiting_time}</span>
          </div>
        )}
        {item.thread_count > 1 && (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{item.thread_count} messages</span>
          </div>
        )}
        {item.contact_name && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[100px]">{item.contact_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact variant for queue list with many items
 */
export function WorkItemCardCompact({ item, isSelected, onClick }: WorkItemCardProps) {
  const actionStyle = ACTION_VERB_STYLES[item.action_verb];

  return (
    <div
      onClick={onClick}
      className={cn(
        'px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-200',
        'bg-white',
        isSelected
          ? 'border-blue-500 bg-blue-50/50'
          : 'border-gray-200 hover:bg-gray-50'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: actionStyle.bg,
            color: actionStyle.text,
          }}
        >
          {item.action_verb}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-900 truncate">
          {item.company_name}
        </span>
        {item.waiting_time && (
          <span className="shrink-0 text-xs text-gray-400">
            {item.waiting_time}
          </span>
        )}
      </div>
    </div>
  );
}

export default WorkItemCard;
