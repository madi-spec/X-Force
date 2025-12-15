'use client';

import { useState, useMemo } from 'react';
import { Users, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CalendarHeader,
  CalendarView,
  MiniCalendar,
  MonthView,
  WeekView,
  DayView,
  AgendaView,
  EventDetailPanel,
  CalendarEvent,
} from '@/components/calendar';

interface CalendarClientProps {
  events: CalendarEvent[];
}

export function CalendarClient({ events }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showContactsOnly, setShowContactsOnly] = useState(false);

  // Filter events based on toggle
  const filteredEvents = useMemo(() => {
    return showContactsOnly
      ? events.filter(e => e.contact !== null)
      : events;
  }, [events, showContactsOnly]);

  const contactEventCount = useMemo(() => {
    return events.filter(e => e.contact !== null).length;
  }, [events]);

  // Get dates that have events for mini calendar
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    filteredEvents.forEach(event => {
      const date = new Date(event.metadata.start_time || event.occurred_at);
      dates.add(date.toISOString().split('T')[0]);
    });
    return dates;
  }, [filteredEvents]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);

    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'agenda':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }

    setCurrentDate(newDate);
  };

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
    if (view === 'month') {
      setView('day');
    }
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setView('day');
  };

  const renderView = () => {
    switch (view) {
      case 'month':
        return (
          <MonthView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={setSelectedEvent}
            onDateClick={handleDateClick}
          />
        );
      case 'week':
        return (
          <WeekView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={setSelectedEvent}
          />
        );
      case 'day':
        return (
          <DayView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={setSelectedEvent}
          />
        );
      case 'agenda':
        return (
          <AgendaView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={setSelectedEvent}
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onNavigate={handleNavigate}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 p-4 space-y-4 overflow-y-auto bg-gray-50/50">
          {/* Mini Calendar */}
          <MiniCalendar
            selectedDate={currentDate}
            onDateSelect={handleDateSelect}
            eventDates={eventDates}
          />

          {/* Filter toggle */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Filter Events
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowContactsOnly(false)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  !showContactsOnly
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Globe className="h-4 w-4" />
                All Events
                <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {events.length}
                </span>
              </button>
              <button
                onClick={() => setShowContactsOnly(true)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  showContactsOnly
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Users className="h-4 w-4" />
                Contacts Only
                <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {contactEventCount}
                </span>
              </button>
            </div>
          </div>

          {/* Color legend */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Legend
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-400" />
                <span className="text-gray-600">Online (Contact)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-400" />
                <span className="text-gray-600">In-person (Contact)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-teal-400" />
                <span className="text-gray-600">Online (Other)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gray-400" />
                <span className="text-gray-600">Other</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderView()}
        </div>
      </div>

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
