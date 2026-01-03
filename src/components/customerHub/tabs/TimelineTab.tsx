'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Phone,
  Video,
  FileText,
  Ticket,
  Package,
  User,
  DollarSign,
  Calendar,
  ChevronDown,
  Filter,
  Clock,
} from 'lucide-react';
import { CustomerHubData, TimelineEvent } from '../types';

interface TimelineTabProps {
  data: CustomerHubData;
}

type EventFilter = 'all' | 'communication' | 'deal' | 'support' | 'product';

const eventTypeConfig: Record<string, {
  icon: typeof MessageSquare;
  color: string;
  bgColor: string;
  label: string;
}> = {
  email_sent: { icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Email Sent' },
  email_received: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Email Received' },
  call: { icon: Phone, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Call' },
  meeting: { icon: Video, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Meeting' },
  note_added: { icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Note Added' },
  case_opened: { icon: Ticket, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Case Opened' },
  case_resolved: { icon: Ticket, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Case Resolved' },
  product_activated: { icon: Package, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Product Activated' },
  product_added: { icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Product Added' },
  stage_changed: { icon: DollarSign, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Stage Changed' },
  contact_added: { icon: User, color: 'text-cyan-600', bgColor: 'bg-cyan-100', label: 'Contact Added' },
  renewal: { icon: Calendar, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Renewal' },
};

function formatEventDate(dateStr: string): { date: string; time: string; relative: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  let relative = '';
  if (diffDays === 0) relative = 'Today';
  else if (diffDays === 1) relative = 'Yesterday';
  else if (diffDays < 7) relative = `${diffDays} days ago`;
  else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)} weeks ago`;
  else relative = `${Math.floor(diffDays / 30)} months ago`;

  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    relative,
  };
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const config = eventTypeConfig[event.type] || eventTypeConfig.note_added;
  const Icon = config.icon;
  const { date, time, relative } = formatEventDate(event.timestamp);

  return (
    <div className="flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', config.bgColor)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div className="w-px flex-1 bg-gray-200 my-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{event.title}</p>
              <p className="text-xs text-gray-500">{config.label}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{date}</p>
              <p className="text-xs text-gray-400">{time}</p>
            </div>
          </div>

          {event.description && (
            <p className="text-sm text-gray-600 mt-2">{event.description}</p>
          )}

          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(event.metadata).slice(0, 3).map(([key, value]) => (
                <span key={key} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}

          {event.actor && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-[10px] font-medium text-gray-600">
                  {event.actor.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-gray-500">{event.actor.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{date}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export function TimelineTab({ data }: TimelineTabProps) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const { timeline } = data;

  // Group by category for filtering
  const filteredEvents = timeline.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'communication') return ['email_sent', 'email_received', 'call', 'meeting'].includes(event.type);
    if (filter === 'deal') return ['stage_changed', 'note_added'].includes(event.type);
    if (filter === 'support') return ['case_opened', 'case_resolved'].includes(event.type);
    if (filter === 'product') return ['product_activated', 'product_added', 'renewal'].includes(event.type);
    return true;
  });

  // Group events by date for display
  const groupedEvents: { date: string; events: TimelineEvent[] }[] = [];
  let currentDate = '';

  filteredEvents.forEach((event) => {
    const eventDate = new Date(event.timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (eventDate !== currentDate) {
      currentDate = eventDate;
      groupedEvents.push({ date: eventDate, events: [event] });
    } else {
      groupedEvents[groupedEvents.length - 1].events.push(event);
    }
  });

  const filters: { key: EventFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Activity', count: timeline.length },
    { key: 'communication', label: 'Communications', count: timeline.filter(e => ['email_sent', 'email_received', 'call', 'meeting'].includes(e.type)).length },
    { key: 'deal', label: 'Deal Activity', count: timeline.filter(e => ['stage_changed', 'note_added'].includes(e.type)).length },
    { key: 'support', label: 'Support', count: timeline.filter(e => ['case_opened', 'case_resolved'].includes(e.type)).length },
    { key: 'product', label: 'Product', count: timeline.filter(e => ['product_activated', 'product_added', 'renewal'].includes(e.type)).length },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Filter by:</span>
          </div>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  filter === f.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className="ml-1 opacity-75">({f.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No activity to display</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter !== 'all' ? 'Try changing the filter' : 'Activity will appear here'}
            </p>
          </div>
        ) : (
          <div>
            {groupedEvents.map((group, idx) => (
              <div key={group.date}>
                {idx > 0 && <DateDivider date={group.date} />}
                {idx === 0 && (
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                    {group.date}
                  </p>
                )}
                {group.events.map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load More */}
      {filteredEvents.length >= 20 && (
        <div className="text-center">
          <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            Load more activity
          </button>
        </div>
      )}
    </div>
  );
}
