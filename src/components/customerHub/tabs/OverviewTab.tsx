'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLens, useWidgetVisibility } from '@/lib/lens';
import {
  Package,
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  Heart,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { CustomerHubData, CompanyProduct, Contact, Communication } from '../types';
import { UnifiedTaskStream } from '../UnifiedTaskStream';

interface OverviewTabProps {
  data: CustomerHubData;
}

function ProductCard({ product }: { product: CompanyProduct }) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    in_onboarding: 'bg-blue-100 text-blue-700',
    in_sales: 'bg-purple-100 text-purple-700',
    inactive: 'bg-gray-100 text-gray-600',
    churned: 'bg-red-100 text-red-700',
    declined: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
          <Package className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{product.product?.name || 'Unknown'}</p>
          <p className="text-xs text-gray-500">{product.tier?.name || 'No tier'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {product.mrr && (
          <span className="text-sm font-medium text-gray-900">
            ${product.mrr.toLocaleString()}/mo
          </span>
        )}
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusColors[product.status] || statusColors.inactive)}>
          {product.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-xs font-medium text-gray-600">
          {contact.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
        <p className="text-xs text-gray-500 truncate">{contact.title || contact.email}</p>
      </div>
      {contact.is_primary && (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Primary</span>
      )}
    </div>
  );
}

// Normalize subject by removing RE:, FW:, etc. prefixes
function normalizeSubject(subject: string | null): string {
  if (!subject) return '';
  return subject.replace(/^(re:|fw:|fwd:|aw:|wg:)\s*/gi, '').trim();
}

// Thread group interface
interface ThreadGroup {
  id: string;
  subject: string;
  communications: Communication[];
  earliestDate: string;
  latestDate: string;
  hasInbound: boolean;
  hasOutbound: boolean;
  summary: string | null;
}

// Clean up AI summary to be thread-appropriate (remove "The email" references)
function cleanSummaryForThread(summary: string): string {
  return summary
    .replace(/^The email\s+/i, 'Discussion about ')
    .replace(/^This email\s+/i, 'Discussion about ')
    .replace(/the email\s+/gi, 'the conversation ')
    .replace(/this email\s+/gi, 'the conversation ');
}

// Truncate summary to fit in bubble (max ~300 chars - CSS line-clamp handles visual display)
function truncateSummary(summary: string, maxLength: number = 300): string {
  if (summary.length <= maxLength) return summary;
  const truncated = summary.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

// Generate a summary for a thread from its communications
function generateThreadSummary(communications: Communication[]): string | null {
  if (communications.length === 0) return null;

  const messageCount = communications.length;
  const inboundCount = communications.filter(c => c.direction === 'inbound').length;
  const outboundCount = communications.filter(c => c.direction === 'outbound').length;

  // Collect all AI-generated summaries from the thread
  const aiSummaries = communications
    .filter(c => (c as any).current_analysis?.summary)
    .map(c => cleanSummaryForThread((c as any).current_analysis!.summary!));

  // If we have AI summaries, combine them into a thread overview
  if (aiSummaries.length > 0) {
    let summary: string;
    if (aiSummaries.length === 1) {
      summary = aiSummaries[0];
    } else {
      // Combine multiple AI summaries - take key points from each
      const combined = aiSummaries
        .map(s => s.split('.')[0]) // Take first sentence from each
        .filter(s => s.length > 10)
        .slice(0, 2) // Max 2 key points
        .join('. ');
      summary = combined ? combined + '.' : aiSummaries[0];
    }
    return truncateSummary(summary);
  }

  // Fall back to building a conversation flow summary
  let prefix: string;
  if (inboundCount > 0 && outboundCount > 0) {
    prefix = `${messageCount}-message conversation`;
  } else if (inboundCount > 0) {
    prefix = `${inboundCount} inbound`;
  } else {
    prefix = `${outboundCount} outbound`;
  }

  // Get content from first message to show topic
  const firstPreview = communications
    .map(c => c.content_preview)
    .find((p): p is string => !!p && p.length > 20);

  if (firstPreview) {
    const snippet = firstPreview.substring(0, 100);
    return truncateSummary(`${prefix}: "${snippet}${firstPreview.length > 100 ? '...' : ''}"`)
  }

  return prefix;
}

// Group communications into threads (by thread_id or normalized subject, across all dates)
function groupCommunicationsIntoThreads(communications: Communication[]): ThreadGroup[] {
  const threadMap = new Map<string, ThreadGroup>();

  for (const comm of communications) {
    // Group by thread_id if available, otherwise by normalized subject
    const threadKey = comm.thread_id
      ? `thread-${comm.thread_id}`
      : `subject-${normalizeSubject(comm.subject)}`;

    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, {
        id: comm.thread_id || comm.id,
        subject: normalizeSubject(comm.subject) || 'No subject',
        communications: [],
        earliestDate: comm.occurred_at,
        latestDate: comm.occurred_at,
        hasInbound: false,
        hasOutbound: false,
        summary: null,
      });
    }

    const group = threadMap.get(threadKey)!;
    group.communications.push(comm);
    if (comm.direction === 'inbound') group.hasInbound = true;
    if (comm.direction === 'outbound') group.hasOutbound = true;
    if (new Date(comm.occurred_at) > new Date(group.latestDate)) {
      group.latestDate = comm.occurred_at;
    }
    if (new Date(comm.occurred_at) < new Date(group.earliestDate)) {
      group.earliestDate = comm.occurred_at;
    }
  }

  // Sort communications within each thread by date (newest first) and generate summaries
  for (const group of threadMap.values()) {
    group.communications.sort((a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
    group.summary = generateThreadSummary(group.communications);
  }

  // Return sorted by latest date (newest first)
  return Array.from(threadMap.values()).sort((a, b) =>
    new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );
}

export function OverviewTab({ data }: OverviewTabProps) {
  const { config: lensConfig, currentLens } = useLens();
  const showHealth = useWidgetVisibility('health_score');
  const showTasks = useWidgetVisibility('unified_task_stream');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const { company, companyProducts, contacts, stats, tasks, supportCases, communications } = data;

  const activeProducts = companyProducts.filter(p => p.status === 'active');
  const inSalesProducts = companyProducts.filter(p => p.status === 'in_sales');
  const onboardingProducts = companyProducts.filter(p => p.status === 'in_onboarding');

  // Group communications into threads
  const threadGroups = useMemo(() => {
    return groupCommunicationsIntoThreads(communications).slice(0, 8);
  }, [communications]);

  const openCases = supportCases.filter(c => !['resolved', 'closed'].includes(c.status));

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
        {/* Products Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Products</h3>
            <span className="text-xs text-gray-500">
              {activeProducts.length} active · ${stats.totalMrr.toLocaleString()}/mo MRR
            </span>
          </div>

          {companyProducts.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No products yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companyProducts.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              {companyProducts.length > 5 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  +{companyProducts.length - 5} more products
                </p>
              )}
            </div>
          )}
        </div>

        {/* Health & Engagement (lens-aware) */}
        {showHealth && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Health & Engagement</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Heart className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-light text-gray-900">
                  {stats.healthScore !== null ? Math.round(stats.healthScore) : '-'}
                </p>
                <p className="text-xs text-gray-500">Health Score</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-light text-gray-900">
                  {stats.daysSinceContact !== null ? `${stats.daysSinceContact}d` : '-'}
                </p>
                <p className="text-xs text-gray-500">Since Contact</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-light text-gray-900">{stats.openCases}</p>
                <p className="text-xs text-gray-500">Open Cases</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-light text-gray-900">
                  {stats.renewalDays !== null ? `${stats.renewalDays}d` : '-'}
                </p>
                <p className="text-xs text-gray-500">To Renewal</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Recent Communications</h3>
            <span className="text-xs text-gray-500">{communications.length} total</span>
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
                    {/* Thread Header */}
                    <button
                      onClick={() => hasMultiple && toggleThread(thread.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 text-left transition-colors',
                        hasMultiple ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
                        isExpanded ? 'bg-gray-50' : 'bg-white'
                      )}
                    >
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
                        {/* Thread Summary - only when collapsed and has multiple */}
                        {!isExpanded && hasMultiple && thread.summary && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {thread.summary}
                          </p>
                        )}
                      </div>

                      <span className="text-xs text-gray-400 shrink-0">
                        {(() => {
                          const startDate = new Date(thread.earliestDate);
                          const endDate = new Date(thread.latestDate);
                          const sameDay = startDate.toDateString() === endDate.toDateString();
                          return sameDay
                            ? endDate.toLocaleDateString()
                            : `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
                        })()}
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
      </div>

      {/* Sidebar - 1 col */}
      <div className="space-y-6">
        {/* Unified Task Stream (CS lens only) */}
        {showTasks && (
          <UnifiedTaskStream tasks={tasks} companyId={company.id} />
        )}

        {/* Contacts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Key Contacts</h3>
            <span className="text-xs text-gray-500">{contacts.length} total</span>
          </div>

          {contacts.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No contacts yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.slice(0, 5).map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
              {contacts.length > 5 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  +{contacts.length - 5} more contacts
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats based on lens */}
        {currentLens === 'sales' && inSalesProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Active Opportunities</h3>
            <div className="space-y-2">
              {inSalesProducts.map((product) => (
                <div key={product.id} className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{product.product?.name}</p>
                  <p className="text-xs text-gray-500">
                    Stage: {product.current_stage?.name || 'Unknown'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentLens === 'onboarding' && onboardingProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Onboarding Progress</h3>
            <div className="space-y-2">
              {onboardingProducts.map((product) => (
                <div key={product.id} className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{product.product?.name}</p>
                  <p className="text-xs text-gray-500">
                    Stage: {product.current_stage?.name || 'Unknown'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentLens === 'support' && openCases.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Open Cases</h3>
            <div className="space-y-2">
              {openCases.slice(0, 5).map((c) => (
                <div key={c.id} className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.subject}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {c.severity} · {c.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
