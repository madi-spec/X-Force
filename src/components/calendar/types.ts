export interface CalendarEvent {
  id: string;
  subject: string;
  description: string;
  occurred_at: string;
  contact: {
    id: string;
    name: string;
    email: string;
    company?: {
      id: string;
      name: string;
    };
  } | null;
  deal?: {
    id: string;
    name: string;
  } | null;
  metadata: {
    location?: string;
    is_online?: boolean;
    join_url?: string;
    attendees?: Array<{ email: string; name?: string; response?: string }>;
    start_time?: string;
    end_time?: string;
    has_contact?: boolean;
  };
}

export type EventType = 'meeting' | 'call' | 'email' | 'task';

export function getEventColor(event: CalendarEvent): { bg: string; border: string; text: string } {
  // Color based on whether it has a contact (business) or not (personal)
  if (event.contact) {
    if (event.metadata.is_online) {
      // Online meeting with contact - purple
      return { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' };
    }
    // In-person meeting with contact - blue
    return { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' };
  }

  if (event.metadata.is_online) {
    // Online meeting without contact - teal
    return { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-800' };
  }

  // Other events - gray
  return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' };
}

export function formatEventTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}
