'use client';

import { useState } from 'react';
import { Calendar, Users, Globe, MapPin, Video, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CalendarEvent {
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

interface CalendarClientProps {
  events: CalendarEvent[];
}

export function CalendarClient({ events }: CalendarClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showContactsOnly, setShowContactsOnly] = useState(false);

  // Filter events based on toggle
  const filteredEvents = showContactsOnly
    ? events.filter(e => e.contact !== null)
    : events;

  const contactEventCount = events.filter(e => e.contact !== null).length;

  // Group events by date
  const eventsByDate = filteredEvents.reduce((acc, event) => {
    const date = new Date(event.occurred_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            No events yet
          </h2>
          <p className="text-gray-500 text-sm">
            Sync your Microsoft 365 account to see calendar events here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          {/* Filter toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowContactsOnly(false)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                !showContactsOnly
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              All ({events.length})
            </button>
            <button
              onClick={() => setShowContactsOnly(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                showContactsOnly
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Contacts ({contactEventCount})
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Event list */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
          {Object.entries(eventsByDate).map(([date, dateEvents]) => (
            <div key={date}>
              <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">{date}</h3>
              </div>
              {dateEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    selectedEvent?.id === event.id && 'bg-blue-50 hover:bg-blue-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 p-1.5 rounded',
                      event.metadata.is_online ? 'bg-purple-100' : 'bg-blue-100'
                    )}>
                      {event.metadata.is_online ? (
                        <Video className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Calendar className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {event.subject}
                        </span>
                        {event.contact && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                            Contact
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(event.metadata.start_time || event.occurred_at)}</span>
                        {event.metadata.end_time && (
                          <>
                            <span>-</span>
                            <span>{formatTime(event.metadata.end_time)}</span>
                          </>
                        )}
                      </div>
                      {event.contact && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {event.contact.name}
                          {event.contact.company && ` - ${event.contact.company.name}`}
                        </p>
                      )}
                      {!event.contact && event.metadata.attendees && event.metadata.attendees.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {event.metadata.attendees.map(a => a.name || a.email).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Event detail */}
        <div className="w-1/2 overflow-y-auto">
          {selectedEvent ? (
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <div className={cn(
                  'p-2 rounded-lg',
                  selectedEvent.metadata.is_online ? 'bg-purple-100' : 'bg-blue-100'
                )}>
                  {selectedEvent.metadata.is_online ? (
                    <Video className="h-5 w-5 text-purple-600" />
                  ) : (
                    <Calendar className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedEvent.subject}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(selectedEvent.metadata.start_time || selectedEvent.occurred_at).toLocaleString()}
                    </span>
                    {selectedEvent.metadata.end_time && (
                      <>
                        <span>-</span>
                        <span>{formatTime(selectedEvent.metadata.end_time)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              {selectedEvent.metadata.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedEvent.metadata.location}</span>
                </div>
              )}

              {/* Join URL */}
              {selectedEvent.metadata.join_url && (
                <a
                  href={selectedEvent.metadata.join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium mb-6"
                >
                  <Video className="h-4 w-4" />
                  Join Meeting
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {/* Contact info */}
              {selectedEvent.contact && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Linked Contact</h3>
                  <Link
                    href={`/contacts/${selectedEvent.contact.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {selectedEvent.contact.name}
                  </Link>
                  <p className="text-sm text-gray-500">{selectedEvent.contact.email}</p>
                  {selectedEvent.contact.company && (
                    <Link
                      href={`/organizations/${selectedEvent.contact.company.id}`}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      {selectedEvent.contact.company.name}
                    </Link>
                  )}
                </div>
              )}

              {/* Deal info */}
              {selectedEvent.deal && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Linked Deal</h3>
                  <Link
                    href={`/deals/${selectedEvent.deal.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {selectedEvent.deal.name}
                  </Link>
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.metadata.attendees && selectedEvent.metadata.attendees.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Attendees</h3>
                  <div className="space-y-2">
                    {selectedEvent.metadata.attendees.map((attendee, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-900">{attendee.name || attendee.email}</span>
                          {attendee.name && (
                            <span className="text-gray-500 ml-2">{attendee.email}</span>
                          )}
                        </div>
                        {attendee.response && (
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs',
                            attendee.response === 'accepted' && 'bg-green-100 text-green-700',
                            attendee.response === 'declined' && 'bg-red-100 text-red-700',
                            attendee.response === 'tentativelyAccepted' && 'bg-yellow-100 text-yellow-700',
                            attendee.response === 'none' && 'bg-gray-100 text-gray-600'
                          )}>
                            {attendee.response === 'tentativelyAccepted' ? 'Tentative' : attendee.response}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select an event to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
