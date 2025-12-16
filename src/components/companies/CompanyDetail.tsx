'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Edit2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Users,
  Activity,
  Package,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Zap,
  Bot,
  User,
  Eye,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import {
  PIPELINE_STAGES,
  getHealthScoreColor,
  type Company,
  type Contact,
  type Deal,
} from '@/types';
import { CompanySummaryCard } from '@/components/ai/summaries';

interface CompanyDetailProps {
  company: Company;
  contacts: Contact[];
  deals: Deal[];
  activities: any[];
  companyProducts: any[];
  allProducts: any[];
  productCategories: any[];
  watchers: any[];
  signals: any[];
  collaborators: any[];
}

const segmentLabels: Record<string, string> = {
  smb: 'SMB',
  mid_market: 'Mid-Market',
  enterprise: 'Enterprise',
  pe_platform: 'PE Platform',
  franchisor: 'Franchisor',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  cold_lead: { label: 'Cold Lead', color: 'bg-gray-100 text-gray-700' },
  prospect: { label: 'Prospect', color: 'bg-blue-100 text-blue-700' },
  customer: { label: 'Customer', color: 'bg-green-100 text-green-700' },
  churned: { label: 'Churned', color: 'bg-red-100 text-red-700' },
};

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'deals', label: 'Deals' },
  { id: 'activities', label: 'Activities' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'products', label: 'Products' },
];

export function CompanyDetail({
  company,
  contacts,
  deals,
  activities,
  companyProducts,
  allProducts,
  productCategories,
  watchers,
  signals,
  collaborators,
}: CompanyDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const status = statusConfig[company.status] || statusConfig.cold_lead;
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const closedWonDeals = deals.filter(d => d.stage === 'closed_won');
  const closedLostDeals = deals.filter(d => d.stage === 'closed_lost');

  // Calculate MRR from active products
  const totalMRR = companyProducts
    .filter(cp => cp.status === 'active')
    .reduce((sum, cp) => sum + (cp.mrr || 0), 0);

  // Group products by category
  const productsByCategory = productCategories.map(cat => ({
    category: cat,
    owned: companyProducts.filter(cp => cp.product?.category?.id === cat.id),
    available: allProducts.filter(p =>
      p.category?.id === cat.id &&
      !companyProducts.some(cp => cp.product?.id === p.id)
    ),
  }));

  // Get unique team members involved with this company
  const teamMembers = new Map<string, any>();

  // Add deal owners
  openDeals.forEach(deal => {
    if (deal.owner) {
      teamMembers.set(deal.owner.id, {
        ...deal.owner,
        role: 'Deal Owner',
        lastActivity: deal.updated_at,
        dealCount: (teamMembers.get(deal.owner.id)?.dealCount || 0) + 1,
      });
    }
  });

  // Add collaborators
  collaborators.forEach(collab => {
    if (collab.user && !teamMembers.has(collab.user.id)) {
      teamMembers.set(collab.user.id, {
        ...collab.user,
        role: 'Collaborator',
        lastActivity: collab.created_at,
      });
    }
  });

  // Add watchers
  watchers.forEach(watcher => {
    if (watcher.user && !teamMembers.has(watcher.user.id)) {
      teamMembers.set(watcher.user.id, {
        ...watcher.user,
        role: watcher.reason || 'Watching',
        lastActivity: watcher.created_at,
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 className="h-7 w-7 text-gray-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-normal text-gray-900">{company.name}</h1>
                  <span className={cn('text-sm font-medium px-2.5 py-0.5 rounded-full', status.color)}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {company.address?.city && (
                    <>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {company.address.city}, {company.address.state}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span>{company.agent_count} agents</span>
                  <span>•</span>
                  <span>{segmentLabels[company.segment]}</span>
                  {company.crm_platform && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{company.crm_platform}</span>
                    </>
                  )}
                </div>
                {primaryContact && (
                  <p className="text-sm text-gray-500 mt-1">
                    Primary: {primaryContact.name}
                    {primaryContact.email && ` (${primaryContact.email})`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/companies/${company.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4" />
                Edit Company
              </Link>
              <Link
                href={`/deals/new?company=${company.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Deal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* AI Summary */}
          <CompanySummaryCard companyId={company.id} />

          <div className="grid grid-cols-2 gap-6">
          {/* Panel 1: Current Stack */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Current Stack</h2>
              <span className="text-sm text-gray-500">
                MRR: <span className="font-medium text-green-600">{formatCurrency(totalMRR)}</span>
              </span>
            </div>
            <div className="space-y-4">
              {productsByCategory.map(({ category, owned }) => (
                <div key={category.id}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {category.display_name || category.name}
                  </h3>
                  {owned.length > 0 ? (
                    <div className="space-y-2">
                      {owned.map(cp => (
                        <div
                          key={cp.id}
                          className={cn(
                            'flex items-center gap-2 text-sm',
                            cp.status === 'active' ? 'text-gray-900' : 'text-gray-400 line-through'
                          )}
                        >
                          {cp.status === 'active' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span>{cp.product?.display_name || cp.product?.name}</span>
                          {cp.mrr > 0 && (
                            <span className="text-gray-500 ml-auto">
                              {formatCurrency(cp.mrr)}/mo
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">(none)</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: Active Deals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Active Deals ({openDeals.length})
              </h2>
              <Link
                href={`/deals/new?company=${company.id}`}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                New Deal
              </Link>
            </div>
            {openDeals.length > 0 ? (
              <div className="space-y-3">
                {openDeals.map(deal => {
                  const stage = PIPELINE_STAGES.find(s => s.id === deal.stage);
                  return (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{deal.name}</p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            Owner: {deal.owner?.name || 'Unassigned'}
                            {deal.sales_team && ` • ${deal.sales_team.replace('_', ' ')}`}
                          </p>
                        </div>
                        <span className={cn(
                          'text-xs font-medium px-2 py-1 rounded-full text-white',
                          stage?.color || 'bg-gray-500'
                        )}>
                          {stage?.name || deal.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-600">
                          Value: {formatCurrency(deal.estimated_value)}
                        </span>
                        <span className={cn('font-medium', getHealthScoreColor(deal.health_score))}>
                          Health: {deal.health_score}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No active deals</p>
            )}
          </div>

          {/* Panel 3: Product Intelligence */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Product Intelligence</h2>

            {signals.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Recommended
                </h3>
                <div className="space-y-2">
                  {signals.map(signal => (
                    <div key={signal.id} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-1">
                            <Target className="h-4 w-4 text-blue-600" />
                            {signal.product?.display_name || signal.product?.name || 'Unknown Product'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{signal.description}</p>
                        </div>
                        <Link
                          href={`/deals/new?company=${company.id}&product=${signal.product?.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Create Deal
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products not yet pitched */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Not Yet Pitched
              </h3>
              <div className="space-y-1">
                {productsByCategory.flatMap(({ available }) => available).slice(0, 3).map(product => (
                  <div key={product.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-600">{product.display_name || product.name}</span>
                    <Link
                      href={`/deals/new?company=${company.id}&product=${product.id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Create Deal
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel 4: Team Involvement */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Team Involvement</h2>
            {teamMembers.size > 0 ? (
              <div className="space-y-3">
                {Array.from(teamMembers.values()).map(member => (
                  <div key={member.id} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">
                        {member.role}
                        {member.dealCount > 1 && ` (${member.dealCount} deals)`}
                      </p>
                      {member.lastActivity && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last activity: {formatRelativeTime(member.lastActivity)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No team members assigned</p>
            )}
          </div>
          </div>
        </div>
      )}

      {activeTab === 'deals' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Deals</h2>
            <Link
              href={`/deals/new?company=${company.id}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Deal
            </Link>
          </div>

          {/* Open Deals */}
          {openDeals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Open ({openDeals.length})</h3>
              <div className="space-y-3">
                {openDeals.map(deal => {
                  const stage = PIPELINE_STAGES.find(s => s.id === deal.stage);
                  return (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{deal.name}</p>
                          <p className="text-sm text-gray-500">
                            {stage?.name} • {deal.owner?.name} • {formatCurrency(deal.estimated_value)}
                          </p>
                        </div>
                        <span className={cn(
                          'text-xs font-medium px-2.5 py-0.5 rounded-full text-white',
                          stage?.color || 'bg-gray-500'
                        )}>
                          {stage?.name}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closed Won */}
          {closedWonDeals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-green-600 mb-3">
                Closed Won ({closedWonDeals.length})
              </h3>
              <div className="space-y-2">
                {closedWonDeals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-600">{deal.name}</span>
                    <span className="text-gray-500">
                      Closed {formatDate(deal.closed_at || deal.updated_at)} - {formatCurrency(deal.estimated_value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Closed Lost */}
          {closedLostDeals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-600 mb-3">
                Closed Lost ({closedLostDeals.length})
              </h3>
              <div className="space-y-2">
                {closedLostDeals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-600">{deal.name}</span>
                    <span className="text-gray-500">
                      Lost {formatDate(deal.closed_at || deal.updated_at)}
                      {deal.lost_reason && ` - "${deal.lost_reason}"`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deals.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No deals yet</p>
          )}
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Activities</h2>
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map(activity => (
                <div key={activity.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Activity className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user?.name}</span>
                      {' '}{activity.type.replace('_', ' ')}
                      {activity.subject && `: ${activity.subject}`}
                    </p>
                    {activity.deal && (
                      <Link
                        href={`/deals/${activity.deal.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Deal: {activity.deal.name}
                      </Link>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatRelativeTime(activity.occurred_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No activities yet</p>
          )}
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Contacts</h2>
            <Link
              href={`/contacts/new?company_id=${company.id}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </Link>
          </div>
          {contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {contact.name}
                        {contact.is_primary && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{contact.title || 'No title'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      href={`/contacts/${contact.id}/edit`}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No contacts yet</p>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Product History</h2>
          <div className="space-y-6">
            {productsByCategory.map(({ category, owned, available }) => (
              <div key={category.id}>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  {category.display_name || category.name}
                </h3>
                <div className="space-y-2">
                  {owned.map(cp => (
                    <div
                      key={cp.id}
                      className="p-3 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {cp.status === 'active' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : cp.status === 'churned' ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={cn(
                            'font-medium',
                            cp.status === 'active' ? 'text-gray-900' : 'text-gray-500'
                          )}>
                            {cp.product?.display_name || cp.product?.name}
                          </span>
                        </div>
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          cp.status === 'active' ? 'bg-green-100 text-green-700' :
                          cp.status === 'churned' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        )}>
                          {cp.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Since {formatDate(cp.started_at || cp.created_at)}
                        {cp.mrr > 0 && ` • MRR: ${formatCurrency(cp.mrr)}`}
                      </p>
                    </div>
                  ))}
                  {available.map(product => (
                    <div
                      key={product.id}
                      className="p-3 rounded-lg border border-dashed border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full border border-gray-300" />
                          <span className="text-gray-500">{product.display_name || product.name}</span>
                        </div>
                        <Link
                          href={`/deals/new?company=${company.id}&product=${product.id}`}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Create Deal
                        </Link>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">Not sold</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
