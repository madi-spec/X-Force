'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, User, Clock, AlertTriangle, AlertCircle,
  CheckCircle, XCircle, RotateCcw, UserPlus, Loader2, Calendar,
  MessageSquare, Tag, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn, formatDistanceToNow } from '@/lib/utils';
import type {
  SupportCaseReadModel,
  SupportCaseStatus,
  SupportCaseSeverity
} from '@/types/supportCase';

interface TimelineEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  sequence: number;
  occurredAt: string;
  actor: {
    type: string;
    id: string | null;
  };
}

interface CaseWithRelations extends SupportCaseReadModel {
  company?: {
    id: string;
    name: string;
    domain?: string;
  } | null;
  owner?: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

interface CaseDetailViewProps {
  caseData: CaseWithRelations;
  timeline: TimelineEvent[];
}

const statusConfig: Record<SupportCaseStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-purple-700', bg: 'bg-purple-100' },
  waiting_on_customer: { label: 'Waiting on Customer', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  waiting_on_internal: { label: 'Waiting on Internal', color: 'text-orange-700', bg: 'bg-orange-100' },
  escalated: { label: 'Escalated', color: 'text-red-700', bg: 'bg-red-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const severityConfig: Record<SupportCaseSeverity, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
  medium: { label: 'Medium', color: 'text-blue-700', bg: 'bg-blue-100' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-700', bg: 'bg-red-100' },
  critical: { label: 'Critical', color: 'text-red-800', bg: 'bg-red-200' },
};

const eventLabels: Record<string, { label: string; icon: typeof MessageSquare }> = {
  SupportCaseCreated: { label: 'Case Created', icon: MessageSquare },
  SupportCaseAssigned: { label: 'Assigned', icon: UserPlus },
  SupportCaseStatusChanged: { label: 'Status Changed', icon: Tag },
  SupportCaseSeverityChanged: { label: 'Severity Changed', icon: AlertTriangle },
  SupportCaseResolved: { label: 'Resolved', icon: CheckCircle },
  SupportCaseClosed: { label: 'Closed', icon: XCircle },
  SupportCaseReopened: { label: 'Reopened', icon: RotateCcw },
  CustomerMessageLogged: { label: 'Customer Message', icon: MessageSquare },
  AgentResponseSent: { label: 'Agent Response', icon: MessageSquare },
  InternalNoteAdded: { label: 'Internal Note', icon: MessageSquare },
  NextActionSet: { label: 'Next Action Set', icon: Calendar },
  SlaConfigured: { label: 'SLA Configured', icon: Clock },
  SlaBreached: { label: 'SLA Breached', icon: AlertCircle },
};

export function CaseDetailView({ caseData, timeline }: CaseDetailViewProps) {
  const router = useRouter();
  const [isExecuting, setIsExecuting] = useState(false);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const status = statusConfig[caseData.status] || statusConfig.open;
  const severity = severityConfig[caseData.severity] || severityConfig.medium;
  const isBreached = caseData.first_response_breached || caseData.resolution_breached;
  const isClosed = caseData.status === 'closed';
  const isResolved = caseData.status === 'resolved';

  const executeCommand = useCallback(async (command: string, params: Record<string, unknown>) => {
    setIsExecuting(true);
    try {
      const response = await fetch(`/api/cases/${caseData.support_case_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...params }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Command failed');
      }

      // Refresh the page to show updated data
      router.refresh();
      setActionModal(null);
      setFormData({});
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to execute command');
    } finally {
      setIsExecuting(false);
    }
  }, [caseData.support_case_id, router]);

  const displayedTimeline = showAllTimeline ? timeline : timeline.slice(-5);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cases
          </Link>
          <h1 className="text-xl font-normal text-gray-900">{caseData.title || 'Untitled Case'}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.bg, status.color)}>
              {status.label}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', severity.bg, severity.color)}>
              {severity.label}
            </span>
            {isBreached && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertCircle className="h-3 w-3" />
                SLA Breached
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isClosed && !isResolved && (
            <>
              <button
                onClick={() => setActionModal('assign')}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Assign
              </button>
              <button
                onClick={() => setActionModal('status')}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Tag className="h-4 w-4" />
                Status
              </button>
              <button
                onClick={() => setActionModal('resolve')}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Resolve
              </button>
            </>
          )}
          {isResolved && !isClosed && (
            <button
              onClick={() => executeCommand('close', { close_reason: 'resolved' })}
              disabled={isExecuting}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-gray-600 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Close Case
            </button>
          )}
          {(isClosed || isResolved) && (
            <button
              onClick={() => setActionModal('reopen')}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {caseData.description || 'No description provided.'}
            </p>
          </div>

          {/* Resolution (if resolved) */}
          {caseData.resolution_summary && (
            <div className="bg-green-50 rounded-xl border border-green-200 p-6">
              <h2 className="text-sm font-medium text-green-700 uppercase tracking-wider mb-3">Resolution</h2>
              <p className="text-green-800 whitespace-pre-wrap">{caseData.resolution_summary}</p>
              {caseData.root_cause && (
                <>
                  <h3 className="text-sm font-medium text-green-700 uppercase tracking-wider mt-4 mb-2">Root Cause</h3>
                  <p className="text-green-800 whitespace-pre-wrap">{caseData.root_cause}</p>
                </>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Timeline</h2>
              {timeline.length > 5 && (
                <button
                  onClick={() => setShowAllTimeline(!showAllTimeline)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  {showAllTimeline ? (
                    <>Show Less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Show All ({timeline.length}) <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {displayedTimeline.map((event, idx) => {
                const eventConfig = eventLabels[event.type] || { label: event.type, icon: MessageSquare };
                const Icon = eventConfig.icon;
                const data = event.data as Record<string, unknown>;

                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-gray-500" />
                      </div>
                      {idx < displayedTimeline.length - 1 && (
                        <div className="w-px h-full bg-gray-200 my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900">{eventConfig.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDistanceToNow(new Date(event.occurredAt))} ago
                        {event.actor.type !== 'system' && ' by ' + event.actor.type}
                      </p>
                      {event.type === 'SupportCaseAssigned' && data.toOwnerName ? (
                        <p className="text-sm text-gray-600 mt-1">
                          Assigned to {String(data.toOwnerName)}
                        </p>
                      ) : null}
                      {event.type === 'SupportCaseStatusChanged' ? (
                        <p className="text-sm text-gray-600 mt-1">
                          {String(data.fromStatus)} → {String(data.toStatus)}
                        </p>
                      ) : null}
                      {event.type === 'SupportCaseSeverityChanged' ? (
                        <p className="text-sm text-gray-600 mt-1">
                          {String(data.fromSeverity)} → {String(data.toSeverity)}
                        </p>
                      ) : null}
                      {event.type === 'SlaBreached' ? (
                        <p className="text-sm text-red-600 mt-1">
                          {String(data.slaType)} SLA breached ({Number(data.hoursOver).toFixed(1)}h over)
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {timeline.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No events recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Company</dt>
                <dd className="mt-0.5">
                  {caseData.company ? (
                    <Link
                      href={`/companies/${caseData.company.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-900 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {caseData.company.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Owner</dt>
                <dd className="mt-0.5">
                  {caseData.owner_name ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-900">
                      <User className="h-4 w-4" />
                      {caseData.owner_name}
                    </span>
                  ) : (
                    <span className="text-sm text-orange-500">Unassigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Category</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {caseData.category || '-'}
                  {caseData.subcategory && ` / ${caseData.subcategory}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Source</dt>
                <dd className="mt-0.5 text-sm text-gray-900 capitalize">{caseData.source || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Opened</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {new Date(caseData.opened_at).toLocaleDateString()}
                </dd>
              </div>
              {caseData.resolved_at && (
                <div>
                  <dt className="text-xs text-gray-500">Resolved</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {new Date(caseData.resolved_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {caseData.closed_at && (
                <div>
                  <dt className="text-xs text-gray-500">Closed</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {new Date(caseData.closed_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* SLA Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">SLA Status</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">First Response</dt>
                <dd className="mt-0.5">
                  {caseData.first_response_at ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Met
                    </span>
                  ) : caseData.first_response_breached ? (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      Breached
                    </span>
                  ) : caseData.first_response_due_at ? (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      Due {formatDistanceToNow(new Date(caseData.first_response_due_at))}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Not set</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Resolution</dt>
                <dd className="mt-0.5">
                  {caseData.resolved_at ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Met
                    </span>
                  ) : caseData.resolution_breached ? (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      Breached
                    </span>
                  ) : caseData.resolution_due_at ? (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      Due {formatDistanceToNow(new Date(caseData.resolution_due_at))}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Not set</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Metrics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Metrics</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">Responses</dt>
                <dd className="text-sm text-gray-900">{caseData.response_count || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">Escalations</dt>
                <dd className="text-sm text-gray-900">{caseData.escalation_count || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">Reopens</dt>
                <dd className="text-sm text-gray-900">{caseData.reopen_count || 0}</dd>
              </div>
              {caseData.csat_score !== null && (
                <div className="flex justify-between">
                  <dt className="text-xs text-gray-500">CSAT</dt>
                  <dd className="text-sm text-gray-900">{caseData.csat_score}/5</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            {actionModal === 'assign' && (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Case</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                    <input
                      type="text"
                      value={formData.owner_name || ''}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter owner name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team (optional)</label>
                    <input
                      type="text"
                      value={formData.team || ''}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter team"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => { setActionModal(null); setFormData({}); }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeCommand('assign', {
                      owner_id: crypto.randomUUID(),
                      owner_name: formData.owner_name,
                      team: formData.team,
                    })}
                    disabled={isExecuting || !formData.owner_name}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isExecuting ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </>
            )}

            {actionModal === 'status' && (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Status</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                    <select
                      value={formData.to_status || ''}
                      onChange={(e) => setFormData({ ...formData, to_status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select status...</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_on_customer">Waiting on Customer</option>
                      <option value="waiting_on_internal">Waiting on Internal</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <textarea
                      value={formData.reason || ''}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Enter reason for status change"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => { setActionModal(null); setFormData({}); }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeCommand('change_status', {
                      to_status: formData.to_status,
                      reason: formData.reason,
                    })}
                    disabled={isExecuting || !formData.to_status}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isExecuting ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </>
            )}

            {actionModal === 'resolve' && (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Resolve Case</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Summary</label>
                    <textarea
                      value={formData.resolution_summary || ''}
                      onChange={(e) => setFormData({ ...formData, resolution_summary: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describe how the case was resolved..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Root Cause (optional)</label>
                    <textarea
                      value={formData.root_cause || ''}
                      onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="What caused this issue?"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => { setActionModal(null); setFormData({}); }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeCommand('resolve', {
                      resolution_summary: formData.resolution_summary,
                      root_cause: formData.root_cause,
                    })}
                    disabled={isExecuting || !formData.resolution_summary}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50"
                  >
                    {isExecuting ? 'Resolving...' : 'Resolve Case'}
                  </button>
                </div>
              </>
            )}

            {actionModal === 'reopen' && (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Reopen Case</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Reopening</label>
                    <textarea
                      value={formData.reason || ''}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Why does this case need to be reopened?"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => { setActionModal(null); setFormData({}); }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeCommand('reopen', { reason: formData.reason })}
                    disabled={isExecuting || !formData.reason}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-xl hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isExecuting ? 'Reopening...' : 'Reopen Case'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
