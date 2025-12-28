'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  RefreshCw,
  Clock,
  CalendarCheck,
  AlertCircle,
  ChevronRight,
  Building2,
  User,
  Loader2,
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Calendar,
  Zap,
  ChevronDown,
  PenSquare,
  LayoutGrid,
  ListTodo,
  Settings,
  BarChart3,
  Pause,
  Play,
  MoreHorizontal,
  ExternalLink,
  Phone,
  Sparkles,
} from 'lucide-react';
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
import { ScheduleMeetingModal } from '@/components/scheduler/ScheduleMeetingModal';
import { SchedulingRequestDetailModal } from '@/components/scheduler/SchedulingRequestDetailModal';
import { QuickBookModal } from '@/components/scheduler/QuickBookModal';

// Types from scheduler
interface SchedulingRequestSummary {
  id: string;
  title: string | null;
  meeting_type: string;
  company_name: string;
  primary_contact: string;
  status: string;
  scheduled_time: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  attempt_count: number;
  no_show_count: number;
}

interface SchedulerDashboardData {
  pending: SchedulingRequestSummary[];
  confirmed: SchedulingRequestSummary[];
  needs_attention: SchedulingRequestSummary[];
  completed_this_week: { held: number; no_shows: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  initiated: { label: 'New', color: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3 w-3" /> },
  proposing: { label: 'Sending', color: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  awaiting_response: { label: 'Awaiting', color: 'bg-yellow-100 text-yellow-700', icon: <Mail className="h-3 w-3" /> },
  negotiating: { label: 'Negotiating', color: 'bg-orange-100 text-orange-700', icon: <MessageSquare className="h-3 w-3" /> },
  confirming: { label: 'Confirming', color: 'bg-purple-100 text-purple-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700', icon: <CalendarCheck className="h-3 w-3" /> },
  reminder_sent: { label: 'Reminded', color: 'bg-green-100 text-green-700', icon: <CalendarCheck className="h-3 w-3" /> },
  completed: { label: 'Done', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: <XCircle className="h-3 w-3" /> },
  paused: { label: 'Paused', color: 'bg-gray-100 text-gray-600', icon: <Clock className="h-3 w-3" /> },
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  follow_up: 'Follow-up',
  technical: 'Technical',
  executive: 'Executive',
  custom: 'Custom',
};

interface UnifiedCalendarClientProps {
  events: CalendarEvent[];
  defaultView?: 'calendar' | 'scheduler';
}

export function UnifiedCalendarClient({ events: initialEvents, defaultView = 'calendar' }: UnifiedCalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schedulerData, setSchedulerData] = useState<SchedulerDashboardData | null>(null);
  const [loadingScheduler, setLoadingScheduler] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'requests' | 'upcoming'>('requests');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['pending', 'confirmed']));
  const [viewMode, setViewMode] = useState<'calendar' | 'scheduler'>(defaultView);
  const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [showNewRequestMenu, setShowNewRequestMenu] = useState(false);

  // Handle double-click on calendar slot to schedule meeting
  const handleSlotDoubleClick = useCallback((date: Date) => {
    setSelectedSlotTime(date);
    setIsModalOpen(true);
  }, []);

  // Handle click on a scheduling request to view details
  const handleRequestClick = useCallback((requestId: string) => {
    setSelectedRequestId(requestId);
    setIsDetailModalOpen(true);
  }, []);

  // Fetch scheduler dashboard data
  const fetchSchedulerData = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler/dashboard');
      if (res.ok) {
        const { data } = await res.json();
        setSchedulerData(data);
      }
    } catch (err) {
      console.error('Error fetching scheduler data:', err);
    } finally {
      setLoadingScheduler(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedulerData();
  }, [fetchSchedulerData]);

  // Combine calendar events with confirmed scheduler meetings
  const allEvents = useMemo(() => {
    const schedulerEvents: CalendarEvent[] = (schedulerData?.confirmed || [])
      .filter(req => req.scheduled_time)
      .map(req => ({
        id: `scheduler-${req.id}`,
        subject: req.title || `${MEETING_TYPE_LABELS[req.meeting_type] || req.meeting_type} with ${req.company_name}`,
        description: `Meeting with ${req.primary_contact}`,
        occurred_at: req.scheduled_time!,
        contact: {
          id: '',
          name: req.primary_contact,
          email: '',
          company: { id: '', name: req.company_name },
        },
        deal: null,
        metadata: {
          start_time: req.scheduled_time!,
          end_time: new Date(new Date(req.scheduled_time!).getTime() + 30 * 60000).toISOString(),
          is_online: true,
          is_scheduler: true,
          scheduler_status: req.status,
        },
      }));

    return [...initialEvents, ...schedulerEvents];
  }, [initialEvents, schedulerData]);

  // Get dates with events for mini calendar
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    allEvents.forEach(event => {
      const date = new Date(event.metadata.start_time || event.occurred_at);
      dates.add(date.toISOString().split('T')[0]);
    });
    return dates;
  }, [allEvents]);

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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (days > 1) return `in ${days}d`;
    if (days === 1) return 'tomorrow';
    if (hours > 1) return `in ${hours}h`;
    if (hours > -1) return 'soon';
    if (hours > -24) return `${Math.abs(hours)}h ago`;
    return `${Math.abs(days)}d ago`;
  };

  const formatMeetingTime = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderView = () => {
    switch (view) {
      case 'month':
        return (
          <MonthView
            currentDate={currentDate}
            events={allEvents}
            onEventClick={setSelectedEvent}
            onDateClick={handleDateClick}
          />
        );
      case 'week':
        return (
          <WeekView
            currentDate={currentDate}
            events={allEvents}
            onEventClick={setSelectedEvent}
            onSlotDoubleClick={handleSlotDoubleClick}
          />
        );
      case 'day':
        return (
          <DayView
            currentDate={currentDate}
            events={allEvents}
            onEventClick={setSelectedEvent}
            onSlotDoubleClick={handleSlotDoubleClick}
          />
        );
      case 'agenda':
        return (
          <AgendaView
            currentDate={currentDate}
            events={allEvents}
            onEventClick={setSelectedEvent}
          />
        );
    }
  };

  const pendingCount = schedulerData?.pending.length || 0;
  const confirmedCount = schedulerData?.confirmed.length || 0;
  const needsAttentionCount = schedulerData?.needs_attention.length || 0;

  // Scheduler View Component
  const renderSchedulerView = () => (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      {/* Quick Links */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-gray-500">Quick Actions:</span>
        <div className="relative">
          <button
            onClick={() => setShowNewRequestMenu(!showNewRequestMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Meeting
            <ChevronDown className="h-3 w-3 ml-1" />
          </button>
          {showNewRequestMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowNewRequestMenu(false)}
              />
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    setIsModalOpen(true);
                    setShowNewRequestMenu(false);
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">AI Scheduler</div>
                    <div className="text-xs text-gray-500">AI drafts email & handles back-and-forth</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsQuickBookOpen(true);
                    setShowNewRequestMenu(false);
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <Phone className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Quick Book</div>
                    <div className="text-xs text-gray-500">Book now while on a call</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
        <Link
          href="/scheduler/settings"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-3 w-3" />
          Settings
        </Link>
        <Link
          href="/scheduler/analytics"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <BarChart3 className="h-3 w-3" />
          Analytics
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs">In Progress</span>
          </div>
          <div className="text-2xl font-light text-gray-900">{pendingCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CalendarCheck className="h-4 w-4" />
            <span className="text-xs">Confirmed</span>
          </div>
          <div className="text-2xl font-light text-gray-900">{confirmedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Needs Attention</span>
          </div>
          <div className="text-2xl font-light text-gray-900">{needsAttentionCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Completed This Week</span>
          </div>
          <div className="text-2xl font-light text-gray-900">
            {schedulerData?.completed_this_week.held || 0}
            {(schedulerData?.completed_this_week.no_shows || 0) > 0 && (
              <span className="text-sm text-red-500 ml-2">
                ({schedulerData?.completed_this_week.no_shows} no-show)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention */}
        {needsAttentionCount > 0 && (
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-medium text-gray-900">Needs Attention</h3>
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {needsAttentionCount}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {schedulerData?.needs_attention.map(req => (
                <SchedulerRequestRow key={req.id} request={req} formatRelativeTime={formatRelativeTime} onClick={() => handleRequestClick(req.id)} />
              ))}
            </div>
          </div>
        )}

        {/* In Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-medium text-gray-900">In Progress</h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {pendingCount === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No scheduling requests in progress
              </div>
            ) : (
              schedulerData?.pending.map(req => (
                <SchedulerRequestRow key={req.id} request={req} formatRelativeTime={formatRelativeTime} onClick={() => handleRequestClick(req.id)} />
              ))
            )}
          </div>
        </div>

        {/* Confirmed/Upcoming */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-medium text-gray-900">Upcoming Meetings</h3>
              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                {confirmedCount}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {confirmedCount === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No upcoming confirmed meetings
              </div>
            ) : (
              schedulerData?.confirmed.map(req => (
                <div
                  key={req.id}
                  onClick={() => handleRequestClick(req.id)}
                  className="p-3 bg-green-50 rounded-lg border border-green-100 cursor-pointer hover:shadow-sm hover:border-green-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {req.company_name}
                      </span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">
                      {formatRelativeTime(req.scheduled_time)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    {formatMeetingTime(req.scheduled_time)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span>{req.primary_contact}</span>
                    <span className="text-gray-300">•</span>
                    <span>{MEETING_TYPE_LABELS[req.meeting_type] || req.meeting_type}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* View Mode Toggle Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                viewMode === 'calendar'
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setViewMode('scheduler')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                viewMode === 'scheduler'
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <ListTodo className="h-3.5 w-3.5" />
              Scheduler
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSchedulerData}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loadingScheduler && "animate-spin")} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowNewRequestMenu(!showNewRequestMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Meeting
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </button>
            {showNewRequestMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNewRequestMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setIsModalOpen(true);
                      setShowNewRequestMenu(false);
                    }}
                    className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">AI Scheduler</div>
                      <div className="text-xs text-gray-500">AI drafts email & handles replies</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsQuickBookOpen(true);
                      setShowNewRequestMenu(false);
                    }}
                    className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <Phone className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Quick Book</div>
                      <div className="text-xs text-gray-500">Book now while on a call</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Conditional Header - Only show CalendarHeader when in calendar mode */}
      {viewMode === 'calendar' && (
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onViewChange={setView}
          onNavigate={handleNavigate}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'scheduler' ? (
          /* Scheduler View */
          loadingScheduler ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            renderSchedulerView()
          )
        ) : (
          <>
            {/* Calendar view */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {renderView()}
            </div>

            {/* Right Sidebar - Scheduling */}
            <div className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col bg-gray-50/50 overflow-hidden">
          {/* Mini Calendar */}
          <div className="p-3 border-b border-gray-200">
            <MiniCalendar
              selectedDate={currentDate}
              onDateSelect={handleDateSelect}
              eventDates={eventDates}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 p-3 border-b border-gray-200">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{pendingCount}</div>
              <div className="text-[10px] text-gray-500">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{confirmedCount}</div>
              <div className="text-[10px] text-gray-500">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{needsAttentionCount}</div>
              <div className="text-[10px] text-gray-500">Attention</div>
            </div>
          </div>

          {/* Scheduling Requests */}
          <div className="flex-1 overflow-y-auto">
            {loadingScheduler ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {/* Needs Attention */}
                {needsAttentionCount > 0 && (
                  <div className="bg-white rounded-lg border border-red-200">
                    <button
                      onClick={() => toggleSection('attention')}
                      className="w-full flex items-center justify-between px-3 py-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-xs font-medium text-red-700">Needs Attention</span>
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                          {needsAttentionCount}
                        </span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-gray-400 transition-transform",
                        !expandedSections.has('attention') && "-rotate-90"
                      )} />
                    </button>
                    {expandedSections.has('attention') && (
                      <div className="px-2 pb-2 space-y-1.5">
                        {schedulerData?.needs_attention.slice(0, 3).map(req => (
                          <RequestCard key={req.id} request={req} formatRelativeTime={formatRelativeTime} onClick={() => handleRequestClick(req.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Pending Requests */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <button
                    onClick={() => toggleSection('pending')}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-medium text-gray-700">In Progress</span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {pendingCount}
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-gray-400 transition-transform",
                      !expandedSections.has('pending') && "-rotate-90"
                    )} />
                  </button>
                  {expandedSections.has('pending') && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {pendingCount === 0 ? (
                        <div className="text-center py-4 text-xs text-gray-500">
                          No scheduling in progress
                        </div>
                      ) : (
                        schedulerData?.pending.slice(0, 5).map(req => (
                          <RequestCard key={req.id} request={req} formatRelativeTime={formatRelativeTime} onClick={() => handleRequestClick(req.id)} />
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Upcoming Confirmed */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <button
                    onClick={() => toggleSection('confirmed')}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-medium text-gray-700">Upcoming</span>
                      <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">
                        {confirmedCount}
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-gray-400 transition-transform",
                      !expandedSections.has('confirmed') && "-rotate-90"
                    )} />
                  </button>
                  {expandedSections.has('confirmed') && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {confirmedCount === 0 ? (
                        <div className="text-center py-4 text-xs text-gray-500">
                          No upcoming meetings
                        </div>
                      ) : (
                        schedulerData?.confirmed.slice(0, 5).map(req => (
                          <div
                            key={req.id}
                            onClick={() => handleRequestClick(req.id)}
                            className="p-2 bg-green-50 rounded border border-green-100 cursor-pointer hover:shadow-sm hover:border-green-200 transition-all"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-900 truncate">
                                {req.company_name}
                              </span>
                              <span className="text-[10px] text-green-600">
                                {formatRelativeTime(req.scheduled_time)}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-600">
                              {formatMeetingTime(req.scheduled_time)}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">
                              {req.primary_contact}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hint */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <p className="text-[10px] text-gray-400 text-center">
              Double-click on calendar to schedule
            </p>
          </div>
            </div>
          </>
        )}
      </div>

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSlotTime(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setSelectedSlotTime(null);
          fetchSchedulerData();
        }}
      />

      {/* Scheduling Request Detail Modal */}
      <SchedulingRequestDetailModal
        isOpen={isDetailModalOpen}
        requestId={selectedRequestId}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRequestId(null);
        }}
        onUpdated={fetchSchedulerData}
      />

      {/* Quick Book Modal */}
      <QuickBookModal
        isOpen={isQuickBookOpen}
        onClose={() => setIsQuickBookOpen(false)}
        onSuccess={() => {
          setIsQuickBookOpen(false);
          fetchSchedulerData();
        }}
      />
    </div>
  );
}

// Request Card Component (compact for sidebar)
function RequestCard({
  request,
  formatRelativeTime,
  onClick
}: {
  request: SchedulingRequestSummary;
  formatRelativeTime: (date: string | null) => string;
  onClick?: () => void;
}) {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.initiated;
  const isOverdue = request.next_action_at && new Date(request.next_action_at) < new Date();

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-2 rounded border cursor-pointer hover:shadow-sm transition-all",
        isOverdue ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-900 truncate flex-1">
          {request.company_name}
        </span>
        <span className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-0.5',
          statusConfig.color
        )}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <span className="truncate">{request.primary_contact}</span>
        <span className="text-gray-300">•</span>
        <span>{MEETING_TYPE_LABELS[request.meeting_type] || request.meeting_type}</span>
      </div>
      {request.next_action_at && (
        <div className={cn(
          "text-[10px] mt-1",
          isOverdue ? "text-amber-600" : "text-gray-400"
        )}>
          {isOverdue && <AlertCircle className="h-2.5 w-2.5 inline mr-0.5" />}
          Next: {formatRelativeTime(request.next_action_at)}
        </div>
      )}
    </div>
  );
}

// Scheduler Request Row (larger for scheduler view)
function SchedulerRequestRow({
  request,
  formatRelativeTime,
  onClick
}: {
  request: SchedulingRequestSummary;
  formatRelativeTime: (date: string | null) => string;
  onClick?: () => void;
}) {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.initiated;
  const isOverdue = request.next_action_at && new Date(request.next_action_at) < new Date();

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all",
        isOverdue ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100 hover:border-gray-200"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {request.company_name}
          </span>
        </div>
        <span className={cn(
          'px-2 py-1 rounded text-xs font-medium flex items-center gap-1',
          statusConfig.color
        )}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>{request.primary_contact}</span>
        </div>
        <span className="text-gray-300">•</span>
        <span>{MEETING_TYPE_LABELS[request.meeting_type] || request.meeting_type}</span>
        <span className="text-gray-300">•</span>
        <span>{request.attempt_count} attempt{request.attempt_count !== 1 ? 's' : ''}</span>
      </div>
      {request.next_action_at && (
        <div className={cn(
          "text-xs flex items-center gap-1",
          isOverdue ? "text-amber-600" : "text-gray-400"
        )}>
          {isOverdue && <AlertCircle className="h-3 w-3" />}
          <span>Next action: {formatRelativeTime(request.next_action_at)}</span>
        </div>
      )}
    </div>
  );
}
