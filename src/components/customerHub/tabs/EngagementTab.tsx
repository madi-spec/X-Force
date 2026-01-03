'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  HeartHandshake,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { CustomerHubData, Communication } from '../types';
import { UnifiedTaskStream } from '../UnifiedTaskStream';

interface EngagementTabProps {
  data: CustomerHubData;
}

function isValidNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
}

function getHealthTrend(score: number | null): { icon: typeof TrendingUp; color: string; label: string } {
  if (!isValidNumber(score)) return { icon: TrendingUp, color: 'text-gray-400', label: 'Unknown' };
  if (score >= 80) return { icon: TrendingUp, color: 'text-green-600', label: 'Healthy' };
  if (score >= 60) return { icon: TrendingDown, color: 'text-yellow-600', label: 'At Risk' };
  return { icon: AlertTriangle, color: 'text-red-600', label: 'Critical' };
}

// Normalize subject by removing RE:, FW:, etc. prefixes
function normalizeSubject(subject: string | null): string {
  if (!subject) return '';
  return subject.replace(/^(re:|fw:|fwd:|aw:|wg:)\s*/gi, '').trim();
}

// Get date string for grouping (YYYY-MM-DD)
function getDateKey(dateStr: string): string {
  return new Date(dateStr).toISOString().split('T')[0];
}

// Thread group interface
interface ThreadGroup {
  id: string; // thread_id or generated from first comm id
  subject: string;
  dateKey: string;
  communications: Communication[];
  latestDate: string;
  hasInbound: boolean;
  hasOutbound: boolean;
}

// Group communications into threads by day
function groupCommunicationsIntoThreads(communications: Communication[]): ThreadGroup[] {
  const threadMap = new Map<string, ThreadGroup>();

  for (const comm of communications) {
    const dateKey = getDateKey(comm.occurred_at);
    // Use thread_id if available, otherwise use normalized subject + date as key
    const threadKey = comm.thread_id
      ? `${comm.thread_id}-${dateKey}`
      : `subject-${normalizeSubject(comm.subject)}-${dateKey}`;

    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, {
        id: comm.thread_id || comm.id,
        subject: normalizeSubject(comm.subject) || 'No subject',
        dateKey,
        communications: [],
        latestDate: comm.occurred_at,
        hasInbound: false,
        hasOutbound: false,
      });
    }

    const group = threadMap.get(threadKey)!;
    group.communications.push(comm);
    if (comm.direction === 'inbound') group.hasInbound = true;
    if (comm.direction === 'outbound') group.hasOutbound = true;
    if (new Date(comm.occurred_at) > new Date(group.latestDate)) {
      group.latestDate = comm.occurred_at;
    }
  }

  // Sort communications within each thread by date (newest first)
  for (const group of threadMap.values()) {
    group.communications.sort((a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
  }

  // Return sorted by latest date (newest first)
  return Array.from(threadMap.values()).sort((a, b) =>
    new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );
}

export function EngagementTab({ data }: EngagementTabProps) {
  const { company, companyProducts, communications, stats, tasks, contacts } = data;
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const activeProducts = companyProducts.filter(p => p.status === 'active');
  const healthTrend = getHealthTrend(stats.healthScore);
  const HealthIcon = healthTrend.icon;

  // Group communications into threads
  const threadGroups = useMemo(() => {
    return groupCommunicationsIntoThreads(communications).slice(0, 15);
  }, [communications]);

  // Key metrics
  const inboundCount = communications.filter(c => c.direction === 'inbound').length;
  const outboundCount = communications.filter(c => c.direction === 'outbound').length;

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - 2 cols */}
      <div className="lg:col-span-2 space-y-6">
        {/* Health Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Customer Health</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <HeartHandshake className={cn('h-5 w-5 mx-auto mb-2', healthTrend.color)} />
              <p className="text-2xl font-light text-gray-900">
                {isValidNumber(stats.healthScore) ? Math.round(stats.healthScore) : '-'}
              </p>
              <p className="text-xs text-gray-500">Health Score</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <Clock className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-light text-gray-900">
                {stats.daysSinceContact !== null ? stats.daysSinceContact : '-'}
              </p>
              <p className="text-xs text-gray-500">Days Since Contact</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <MessageSquare className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-light text-gray-900">{communications.length}</p>
              <p className="text-xs text-gray-500">Total Communications</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <Calendar className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-light text-gray-900">
                {stats.renewalDays !== null ? `${stats.renewalDays}d` : '-'}
              </p>
              <p className="text-xs text-gray-500">To Renewal</p>
            </div>
          </div>

          {/* Health Status Banner */}
          <div className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            isValidNumber(stats.healthScore) && stats.healthScore >= 80 ? 'bg-green-50' :
            isValidNumber(stats.healthScore) && stats.healthScore >= 60 ? 'bg-yellow-50' :
            isValidNumber(stats.healthScore) ? 'bg-red-50' : 'bg-gray-50'
          )}>
            <HealthIcon className={cn('h-5 w-5', healthTrend.color)} />
            <div>
              <p className={cn('text-sm font-medium', healthTrend.color)}>{healthTrend.label}</p>
              <p className="text-xs text-gray-500">
                {isValidNumber(stats.healthScore) && stats.healthScore >= 80
                  ? 'Customer is engaged and healthy'
                  : isValidNumber(stats.healthScore) && stats.healthScore >= 60
                    ? 'Some engagement concerns - consider reaching out'
                    : isValidNumber(stats.healthScore)
                      ? 'Immediate attention required'
                      : 'No health data available'}
              </p>
            </div>
          </div>
        </div>

        {/* Communication Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Recent Communications</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                {inboundCount} inbound
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                {outboundCount} outbound
              </span>
            </div>
          </div>

          {threadGroups.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No communications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {threadGroups.map((thread) => {
                const isExpanded = expandedThreads.has(thread.id);
                const hasMultiple = thread.communications.length > 1;
                const latestComm = thread.communications[0];

                return (
                  <div key={thread.id} className="rounded-lg border border-gray-100 overflow-hidden">
                    {/* Thread Header - always visible */}
                    <button
                      onClick={() => hasMultiple && toggleThread(thread.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 text-left transition-colors',
                        hasMultiple ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
                        isExpanded ? 'bg-gray-50' : 'bg-white'
                      )}
                    >
                      {/* Expand/collapse indicator or mail icon */}
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        thread.hasInbound && thread.hasOutbound
                          ? 'bg-purple-100'
                          : thread.hasInbound
                            ? 'bg-blue-100'
                            : 'bg-green-100'
                      )}>
                        {hasMultiple ? (
                          isExpanded ? (
                            <ChevronDown className={cn(
                              'h-4 w-4',
                              thread.hasInbound && thread.hasOutbound
                                ? 'text-purple-600'
                                : thread.hasInbound
                                  ? 'text-blue-600'
                                  : 'text-green-600'
                            )} />
                          ) : (
                            <ChevronRight className={cn(
                              'h-4 w-4',
                              thread.hasInbound && thread.hasOutbound
                                ? 'text-purple-600'
                                : thread.hasInbound
                                  ? 'text-blue-600'
                                  : 'text-green-600'
                            )} />
                          )
                        ) : (
                          <Mail className={cn(
                            'h-4 w-4',
                            latestComm.direction === 'inbound' ? 'text-blue-600' : 'text-green-600'
                          )} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {thread.subject}
                          </p>
                          {hasMultiple && (
                            <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                              {thread.communications.length}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {latestComm.direction === 'inbound' ? 'From' : 'To'}: {latestComm.from_email || latestComm.to_email || 'Unknown'}
                        </p>
                      </div>

                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(thread.latestDate).toLocaleDateString()}
                      </span>
                    </button>

                    {/* Expanded thread messages */}
                    {isExpanded && hasMultiple && (
                      <div className="border-t border-gray-100 bg-gray-50/50">
                        {thread.communications.map((comm, idx) => (
                          <div
                            key={comm.id}
                            className={cn(
                              'flex items-start gap-3 p-3 pl-14',
                              idx < thread.communications.length - 1 && 'border-b border-gray-100'
                            )}
                          >
                            <div className={cn(
                              'h-6 w-6 rounded flex items-center justify-center shrink-0',
                              comm.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'
                            )}>
                              <Mail className={cn(
                                'h-3 w-3',
                                comm.direction === 'inbound' ? 'text-blue-600' : 'text-green-600'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700 truncate">
                                {comm.subject || 'No subject'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {comm.direction === 'inbound' ? 'From' : 'To'}: {comm.from_email || comm.to_email || 'Unknown'}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(comm.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Health */}
        {activeProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Product Health</h3>
            <div className="space-y-3">
              {activeProducts.map((product) => {
                const health = product.health_score;
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center',
                        health !== null && health >= 80 ? 'bg-green-100' :
                        health !== null && health >= 60 ? 'bg-yellow-100' :
                        health !== null ? 'bg-red-100' : 'bg-gray-100'
                      )}>
                        {health !== null && health >= 80 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : health !== null && health >= 60 ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        ) : health !== null ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (
                          <HeartHandshake className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.product?.name}</p>
                        <p className="text-xs text-gray-500">{product.tier?.name || 'No tier'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {health !== null ? Math.round(health) : '-'}
                        </p>
                        <p className="text-xs text-gray-500">Health</p>
                      </div>
                      {product.mrr && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">${product.mrr.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">MRR</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - 1 col */}
      <div className="space-y-6">
        {/* Unified Task Stream */}
        <UnifiedTaskStream tasks={tasks} companyId={company.id} />

        {/* Key Contacts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Key Contacts</h3>
          <div className="space-y-3">
            {contacts.slice(0, 5).map((contact) => (
              <div key={contact.id} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                  <p className="text-xs text-gray-500 truncate">{contact.title || contact.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Renewal Info */}
        {stats.renewalDays !== null && (
          <div className={cn(
            'rounded-xl border p-6',
            stats.renewalDays <= 30 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className={cn('h-4 w-4', stats.renewalDays <= 30 ? 'text-amber-600' : 'text-gray-400')} />
              <h3 className="text-sm font-medium text-gray-900">Renewal</h3>
            </div>
            <p className={cn(
              'text-2xl font-light',
              stats.renewalDays <= 30 ? 'text-amber-600' : 'text-gray-900'
            )}>
              {stats.renewalDays} days
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.renewalDays <= 30 ? 'Renewal coming up soon' : 'Until renewal'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
