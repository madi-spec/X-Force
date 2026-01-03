'use client';

import { cn } from '@/lib/utils';
import {
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle2,
  User,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { CustomerHubData, SupportCase } from '../types';

interface SupportTabProps {
  data: CustomerHubData;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function CaseCard({ supportCase }: { supportCase: SupportCase }) {
  const severityConfig: Record<string, { color: string; bgColor: string; icon: typeof AlertCircle }> = {
    critical: { color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertCircle },
    high: { color: 'text-orange-600', bgColor: 'bg-orange-50', icon: AlertTriangle },
    medium: { color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: AlertTriangle },
    low: { color: 'text-gray-500', bgColor: 'bg-gray-50', icon: Ticket },
  };

  const statusConfig: Record<string, { color: string; bgColor: string }> = {
    open: { color: 'text-blue-700', bgColor: 'bg-blue-100' },
    in_progress: { color: 'text-purple-700', bgColor: 'bg-purple-100' },
    waiting_customer: { color: 'text-amber-700', bgColor: 'bg-amber-100' },
    waiting_internal: { color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
    resolved: { color: 'text-green-700', bgColor: 'bg-green-100' },
    closed: { color: 'text-gray-600', bgColor: 'bg-gray-100' },
  };

  const severity = severityConfig[supportCase.severity] || severityConfig.medium;
  const status = statusConfig[supportCase.status] || statusConfig.open;
  const SeverityIcon = severity.icon;

  // Calculate SLA status
  const isBreached = supportCase.sla_breached;
  const slaHoursRemaining = supportCase.sla_due_at
    ? Math.floor((new Date(supportCase.sla_due_at).getTime() - Date.now()) / (1000 * 60 * 60))
    : null;

  return (
    <div className={cn(
      'bg-white rounded-xl border p-6 transition-all hover:shadow-md',
      isBreached ? 'border-red-300' : 'border-gray-200'
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', severity.bgColor)}>
            <SeverityIcon className={cn('h-5 w-5', severity.color)} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 line-clamp-1">{supportCase.subject}</h4>
            <p className="text-xs text-gray-500">
              #{supportCase.id.slice(0, 8)} · Opened {formatTimeAgo(supportCase.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium capitalize', status.bgColor, status.color)}>
            {supportCase.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {supportCase.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{supportCase.description}</p>
      )}

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Severity</p>
          <p className={cn('text-sm font-medium capitalize', severity.color)}>
            {supportCase.severity}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Assigned</p>
          <p className="text-sm font-medium text-gray-900">
            {supportCase.assigned_to?.name?.split(' ')[0] || 'Unassigned'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">SLA</p>
          {isBreached ? (
            <p className="text-sm font-medium text-red-600">Breached</p>
          ) : slaHoursRemaining !== null ? (
            <p className={cn(
              'text-sm font-medium',
              slaHoursRemaining <= 4 ? 'text-orange-600' : 'text-green-600'
            )}>
              {slaHoursRemaining}h left
            </p>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SupportTab({ data }: SupportTabProps) {
  const { supportCases, stats } = data;

  const openCases = supportCases.filter(c => !['resolved', 'closed'].includes(c.status));
  const resolvedCases = supportCases.filter(c => ['resolved', 'closed'].includes(c.status));
  const criticalCases = openCases.filter(c => c.severity === 'critical' || c.severity === 'high');
  const breachedCases = openCases.filter(c => c.sla_breached);

  // Calculate average resolution time (mock - would come from actual data)
  const avgResolutionDays = resolvedCases.length > 0 ? 2.3 : null;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Open Cases</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{openCases.length}</p>
          <p className="text-xs text-gray-500 mt-1">active support tickets</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Critical</span>
          </div>
          <p className={cn(
            'text-2xl font-light',
            criticalCases.length > 0 ? 'text-red-600' : 'text-gray-900'
          )}>
            {criticalCases.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">high priority cases</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">SLA Breached</span>
          </div>
          <p className={cn(
            'text-2xl font-light',
            breachedCases.length > 0 ? 'text-orange-600' : 'text-green-600'
          )}>
            {breachedCases.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">{breachedCases.length === 0 ? 'all within SLA' : 'cases breached'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Avg Resolution</span>
          </div>
          <p className="text-2xl font-light text-gray-900">
            {avgResolutionDays !== null ? `${avgResolutionDays}d` : '-'}
          </p>
          <p className="text-xs text-gray-500 mt-1">days to resolve</p>
        </div>
      </div>

      {/* Open Cases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">Open Cases</h3>
          <button className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
            Create Case
          </button>
        </div>
        {openCases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">No open cases</p>
            <p className="text-sm text-gray-500 mt-1">All support tickets have been resolved</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {openCases.map((supportCase) => (
              <CaseCard key={supportCase.id} supportCase={supportCase} />
            ))}
          </div>
        )}
      </div>

      {/* Resolved Cases */}
      {resolvedCases.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4">Recently Resolved</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolved By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resolvedCases.slice(0, 5).map((supportCase) => (
                  <tr key={supportCase.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{supportCase.subject}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium capitalize',
                        supportCase.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        supportCase.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        supportCase.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        {supportCase.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supportCase.assigned_to?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {supportCase.resolved_at ? new Date(supportCase.resolved_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
