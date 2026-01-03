'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Search, AlertTriangle, Clock, User, Building2,
  AlertCircle, ChevronRight, Filter
} from 'lucide-react';
import { cn, formatDistanceToNow } from '@/lib/utils';
import type {
  SupportCaseReadModel,
  SupportCaseStatus,
  SupportCaseSeverity
} from '@/types/supportCase';

interface CaseWithCompany extends SupportCaseReadModel {
  company?: {
    id: string;
    name: string;
  } | null;
}

interface CasesQueueListProps {
  cases: CaseWithCompany[];
}

const statusConfig: Record<SupportCaseStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  waiting_on_customer: { label: 'Waiting on Customer', color: 'bg-yellow-100 text-yellow-700' },
  waiting_on_internal: { label: 'Waiting on Internal', color: 'bg-orange-100 text-orange-700' },
  escalated: { label: 'Escalated', color: 'bg-red-100 text-red-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
};

const severityConfig: Record<SupportCaseSeverity, { label: string; color: string; icon?: boolean }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700', icon: true },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700', icon: true },
  critical: { label: 'Critical', color: 'bg-red-200 text-red-800', icon: true },
};

export function CasesQueueList({ cases }: CasesQueueListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupportCaseStatus | 'all' | 'active'>('active');
  const [severityFilter, setSeverityFilter] = useState<SupportCaseSeverity | 'all'>('all');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached' | 'at_risk'>('all');

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = c.title?.toLowerCase().includes(query);
        const matchesCompany = c.company?.name?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCompany) return false;
      }

      // Status filter
      if (statusFilter === 'active') {
        if (c.status === 'resolved' || c.status === 'closed') return false;
      } else if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false;

      // SLA filter
      if (slaFilter === 'breached' && !c.first_response_breached && !c.resolution_breached) return false;
      if (slaFilter === 'at_risk') {
        // At risk = close to SLA but not breached yet
        const now = new Date();
        const frDue = c.first_response_due_at ? new Date(c.first_response_due_at) : null;
        const resDue = c.resolution_due_at ? new Date(c.resolution_due_at) : null;
        const hoursUntilFR = frDue ? (frDue.getTime() - now.getTime()) / (1000 * 60 * 60) : Infinity;
        const hoursUntilRes = resDue ? (resDue.getTime() - now.getTime()) / (1000 * 60 * 60) : Infinity;
        const isAtRisk = (hoursUntilFR > 0 && hoursUntilFR < 2) || (hoursUntilRes > 0 && hoursUntilRes < 4);
        if (!isAtRisk) return false;
      }

      return true;
    });
  }, [cases, searchQuery, statusFilter, severityFilter, slaFilter]);

  const stats = useMemo(() => {
    const active = cases.filter(c => c.status !== 'resolved' && c.status !== 'closed');
    return {
      total: cases.length,
      active: active.length,
      breached: cases.filter(c => c.first_response_breached || c.resolution_breached).length,
      urgent: cases.filter(c => c.severity === 'urgent' || c.severity === 'critical').length,
    };
  }, [cases]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Support Cases</h1>
          <p className="text-xs text-gray-500 mt-1">
            {filteredCases.length} of {cases.length} cases
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Case
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</p>
          <p className="text-2xl font-light text-gray-900 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-light text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">SLA Breached</p>
          <p className={cn(
            "text-2xl font-light mt-1",
            stats.breached > 0 ? "text-red-600" : "text-gray-900"
          )}>{stats.breached}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Urgent/Critical</p>
          <p className={cn(
            "text-2xl font-light mt-1",
            stats.urgent > 0 ? "text-orange-600" : "text-gray-900"
          )}>{stats.urgent}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search cases or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SupportCaseStatus | 'all' | 'active')}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="active">Active Cases</option>
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_on_customer">Waiting on Customer</option>
            <option value="waiting_on_internal">Waiting on Internal</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SupportCaseSeverity | 'all')}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* SLA Filter */}
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value as 'all' | 'breached' | 'at_risk')}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All SLA Status</option>
            <option value="breached">SLA Breached</option>
            <option value="at_risk">At Risk</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SLA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opened
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">

              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCases.map((caseItem) => {
              const status = statusConfig[caseItem.status] || statusConfig.open;
              const severity = severityConfig[caseItem.severity] || severityConfig.medium;
              const isBreached = caseItem.first_response_breached || caseItem.resolution_breached;

              return (
                <tr key={caseItem.support_case_id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <Link href={`/cases/${caseItem.support_case_id}`} className="block">
                      <p className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">
                        {caseItem.title || 'Untitled Case'}
                      </p>
                      {caseItem.category && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {caseItem.category}
                          {caseItem.subcategory && ` / ${caseItem.subcategory}`}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {caseItem.company ? (
                      <Link
                        href={`/companies/${caseItem.company.id}`}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <Building2 className="h-4 w-4" />
                        {caseItem.company.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      status.color
                    )}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      severity.color
                    )}>
                      {severity.icon && <AlertTriangle className="h-3 w-3" />}
                      {severity.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isBreached ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Breached
                      </span>
                    ) : caseItem.first_response_due_at || caseItem.resolution_due_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        {caseItem.first_response_due_at && !caseItem.first_response_at
                          ? formatDistanceToNow(new Date(caseItem.first_response_due_at))
                          : caseItem.resolution_due_at
                            ? formatDistanceToNow(new Date(caseItem.resolution_due_at))
                            : '-'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {caseItem.owner_name ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                        <User className="h-3.5 w-3.5" />
                        {caseItem.owner_name}
                      </span>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDistanceToNow(new Date(caseItem.opened_at))} ago
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/cases/${caseItem.support_case_id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      View
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredCases.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {cases.length === 0
                    ? 'No support cases yet.'
                    : 'No cases match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
