'use client';

import { X, Calendar, Clock, MapPin, Video, Users, Building2, ExternalLink, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent, getEventColor, formatEventTime } from './types';
import Link from 'next/link';

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  if (!event) return null;

  const colors = getEventColor(event);
  const eventDate = new Date(event.metadata.start_time || event.occurred_at);

  const getDuration = () => {
    if (!event.metadata.end_time || !event.metadata.start_time) return null;

    const start = new Date(event.metadata.start_time).getTime();
    const end = new Date(event.metadata.end_time).getTime();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className={cn('px-6 py-4 border-b', colors.bg)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', event.metadata.is_online ? 'bg-purple-200' : 'bg-blue-200')}>
                {event.metadata.is_online ? (
                  <Video className="h-5 w-5 text-purple-700" />
                ) : (
                  <Calendar className="h-5 w-5 text-blue-700" />
                )}
              </div>
              <div>
                <h2 className={cn('text-lg font-semibold', colors.text)}>
                  {event.subject}
                </h2>
                {event.contact && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full mt-1">
                    Linked Contact
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">
                {eventDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-gray-600">
                {formatEventTime(event.metadata.start_time || event.occurred_at)}
                {event.metadata.end_time && (
                  <> - {formatEventTime(event.metadata.end_time)}</>
                )}
                {getDuration() && (
                  <span className="text-gray-400 ml-2">({getDuration()})</span>
                )}
              </p>
            </div>
          </div>

          {/* Location */}
          {(event.metadata.location || event.metadata.is_online) && (
            <div className="flex items-start gap-3">
              {event.metadata.is_online ? (
                <Video className="h-5 w-5 text-purple-500 mt-0.5" />
              ) : (
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {event.metadata.is_online ? 'Online Meeting' : event.metadata.location}
                </p>
                {event.metadata.join_url && (
                  <a
                    href={event.metadata.join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    <Video className="h-4 w-4" />
                    Join Meeting
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Linked Contact */}
          {event.contact && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                Linked Contact
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 font-semibold">
                    {event.contact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/contacts/${event.contact.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {event.contact.name}
                  </Link>
                  <p className="text-sm text-gray-500 truncate">{event.contact.email}</p>
                </div>
              </div>
              {event.contact.company && (
                <Link
                  href={`/organizations/${event.contact.company.id}`}
                  className="flex items-center gap-2 mt-3 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Building2 className="h-4 w-4" />
                  {event.contact.company.name}
                </Link>
              )}
            </div>
          )}

          {/* Linked Deal */}
          {event.deal && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                Linked Deal
              </h3>
              <Link
                href={`/deals/${event.deal.id}`}
                className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                {event.deal.name}
              </Link>
            </div>
          )}

          {/* Attendees */}
          {event.metadata.attendees && event.metadata.attendees.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees ({event.metadata.attendees.length})
              </h3>
              <div className="space-y-2">
                {event.metadata.attendees.map((attendee, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {(attendee.name || attendee.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {attendee.name || attendee.email}
                        </p>
                        {attendee.name && (
                          <p className="text-xs text-gray-500">{attendee.email}</p>
                        )}
                      </div>
                    </div>
                    {attendee.response && (
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        attendee.response === 'accepted' && 'bg-green-100 text-green-700',
                        attendee.response === 'declined' && 'bg-red-100 text-red-700',
                        attendee.response === 'tentativelyAccepted' && 'bg-yellow-100 text-yellow-700',
                        attendee.response === 'none' && 'bg-gray-100 text-gray-600'
                      )}>
                        {attendee.response === 'tentativelyAccepted' ? 'Tentative' :
                         attendee.response === 'none' ? 'No response' :
                         attendee.response.charAt(0).toUpperCase() + attendee.response.slice(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {event.contact && (
          <div className="border-t border-gray-200 p-4">
            <Link
              href={`mailto:${event.contact.email}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              <Mail className="h-4 w-4" />
              Email {event.contact.name.split(' ')[0]}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
