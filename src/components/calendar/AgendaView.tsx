'use client';

import { Calendar, Video, MapPin, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent, getEventColor, formatEventTime, isSameDay } from './types';

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function AgendaView({ currentDate, events, onEventClick }: AgendaViewProps) {
  // Get events for the next 30 days from current date
  const getUpcomingEvents = () => {
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    return events
      .filter(event => {
        const eventDate = new Date(event.metadata.start_time || event.occurred_at);
        return eventDate >= startDate && eventDate <= endDate;
      })
      .sort((a, b) => {
        const aTime = new Date(a.metadata.start_time || a.occurred_at).getTime();
        const bTime = new Date(b.metadata.start_time || b.occurred_at).getTime();
        return aTime - bTime;
      });
  };

  // Group events by date
  const groupEventsByDate = (eventList: CalendarEvent[]) => {
    const groups: { date: Date; events: CalendarEvent[] }[] = [];

    eventList.forEach(event => {
      const eventDate = new Date(event.metadata.start_time || event.occurred_at);
      eventDate.setHours(0, 0, 0, 0);

      const existingGroup = groups.find(g => isSameDay(g.date, eventDate));
      if (existingGroup) {
        existingGroup.events.push(event);
      } else {
        groups.push({ date: eventDate, events: [event] });
      }
    });

    return groups;
  };

  const upcomingEvents = getUpcomingEvents();
  const groupedEvents = groupEventsByDate(upcomingEvents);
  const today = new Date();

  const formatDate = (date: Date) => {
    if (isSameDay(date, today)) {
      return 'Today';
    }
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (isSameDay(date, tomorrow)) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDuration = (event: CalendarEvent) => {
    if (!event.metadata.end_time || !event.metadata.start_time) return null;

    const start = new Date(event.metadata.start_time).getTime();
    const end = new Date(event.metadata.end_time).getTime();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  if (upcomingEvents.length === 0) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No upcoming events</h3>
          <p className="text-sm text-gray-500">Events in the next 30 days will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto">
      <div className="max-w-3xl mx-auto py-6 px-4">
        {groupedEvents.map(({ date, events: dateEvents }) => (
          <div key={date.toISOString()} className="mb-8">
            {/* Date header */}
            <div className="flex items-center gap-4 mb-4">
              <div className={cn(
                'flex flex-col items-center justify-center w-14 h-14 rounded-xl',
                isSameDay(date, today) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
              )}>
                <span className="text-xs font-medium uppercase">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="text-xl font-bold">
                  {date.getDate()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {formatDate(date)}
                </h3>
                <p className="text-sm text-gray-500">
                  {dateEvents.length} event{dateEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Events for this date */}
            <div className="space-y-3 ml-[72px]">
              {dateEvents.map(event => {
                const colors = getEventColor(event);
                const duration = getDuration(event);

                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={cn(
                      'w-full text-left p-4 rounded-xl border-l-4 hover:shadow-md transition-shadow',
                      colors.bg,
                      colors.border
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className={cn('font-semibold truncate', colors.text)}>
                          {event.subject}
                        </h4>

                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>
                              {formatEventTime(event.metadata.start_time || event.occurred_at)}
                              {event.metadata.end_time && (
                                <> - {formatEventTime(event.metadata.end_time)}</>
                              )}
                            </span>
                            {duration && (
                              <span className="text-gray-400">({duration})</span>
                            )}
                          </div>
                        </div>

                        {(event.metadata.location || event.metadata.is_online) && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
                            {event.metadata.is_online ? (
                              <>
                                <Video className="h-4 w-4 text-purple-500" />
                                <span>Online Meeting</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4" />
                                <span className="truncate">{event.metadata.location}</span>
                              </>
                            )}
                          </div>
                        )}

                        {event.contact && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
                            <Users className="h-4 w-4" />
                            <span>
                              {event.contact.name}
                              {event.contact.company && (
                                <span className="text-gray-400"> - {event.contact.company.name}</span>
                              )}
                            </span>
                          </div>
                        )}

                        {!event.contact && event.metadata.attendees && event.metadata.attendees.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
                            <Users className="h-4 w-4" />
                            <span className="truncate">
                              {event.metadata.attendees.slice(0, 3).map(a => a.name || (a.email ? a.email.split('@')[0] : 'Unknown')).join(', ')}
                              {event.metadata.attendees.length > 3 && ` +${event.metadata.attendees.length - 3} more`}
                            </span>
                          </div>
                        )}
                      </div>

                      {event.contact && (
                        <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Contact
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
