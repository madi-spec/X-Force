'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLens } from '@/lib/lens';
import {
  ArrowLeft,
  Building2,
  Edit2,
  Flag,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Users,
  Activity,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Zap,
  Bot,
  Layers,
  PlayCircle,
  PauseCircle,
  TrendingUp,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import {
  PIPELINE_STAGES,
  getHealthScoreColor,
  type Company,
  type Contact,
  type Deal,
} from '@/types';
import { CompanyResearchTab, IntelligenceOverviewPanel } from '@/components/intelligence';
import { AccountMemoryPanel } from '@/components/companies/AccountMemoryPanel';
import { QuickFlagModal } from '@/components/companies/QuickFlagModal';
import { ContactCardWithFacts } from '@/components/contacts';
import {
  RelationshipSummaryCard,
  KeyFactsPanel,
  CommunicationTimeline,
  SignalsPanel,
  StakeholderMap,
  ActiveActionsPanel,
} from '@/components/relationship';

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

const industryLabels: Record<string, { label: string; color: string }> = {
  pest: { label: 'Pest', color: 'bg-amber-100 text-amber-700' },
  lawn: { label: 'Lawn', color: 'bg-green-100 text-green-700' },
  both: { label: 'Both', color: 'bg-purple-100 text-purple-700' },
};

// Product status configuration for new product-centric model
const productStatusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  active: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  in_onboarding: { label: 'Onboarding', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: PlayCircle },
  in_sales: { label: 'In Sales', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: TrendingUp },
  inactive: { label: 'Not Started', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  declined: { label: 'Declined', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: XCircle },
  churned: { label: 'Churned', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
};

// Product type icons
const productTypeIcons: Record<string, { icon: any; color: string }> = {
  suite: { icon: Layers, color: 'text-blue-600' },
  addon: { icon: Zap, color: 'text-purple-600' },
  module: { icon: Bot, color: 'text-green-600' },
};

// Helper to parse address string to get city/state
function parseAddress(address: string | { city?: string; state?: string } | null | undefined): string | null {
  if (!address) return null;

  // If it's already an object with city/state
  if (typeof address === 'object' && address.city) {
    return `${address.city}${address.state ? `, ${address.state}` : ''}`;
  }

  // If it's a string, try to extract city, state from format like "123 Main St  City, ST 12345"
  if (typeof address === 'string') {
    // Many addresses use double-space to separate street from city/state/zip
    // e.g., "830 Kennesaw Ave NW  Marietta, GA 30060"
    const parts = address.split(/\s{2,}/);
    const cityStateZip = parts.length > 1 ? parts[parts.length - 1] : address;

    // Match "City, ST 12345" or "City, ST" pattern
    const match = cityStateZip.match(/^([^,]+),\s*([A-Z]{2})(?:\s+\d{5})?/);
    if (match) {
      return `${match[1].trim()}, ${match[2]}`;
    }

    // Fallback: return truncated address if no city/state pattern found
    return address.length > 40 ? address.substring(0, 40) + '...' : address;
  }

  return null;
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'relationship', label: 'Relationship Context' },
  { id: 'deals', label: 'Deals' },
  { id: 'activities', label: 'Activities' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'products', label: 'Products' },
  { id: 'memory', label: 'What We\'ve Learned' },
  { id: 'research', label: 'Company Research' },
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { config: lensConfig } = useLens();
  const tabFromUrl = searchParams.get('tab');

  // Use lens's default tab if no tab is specified in URL
  const defaultTab = lensConfig.defaultCustomerTab;
  const [activeTab, setActiveTab] = useState(tabFromUrl || defaultTab);
  const [relationshipData, setRelationshipData] = useState<any>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [editingCompanyProduct, setEditingCompanyProduct] = useState<any>(null);
  const [startingSaleProductId, setStartingSaleProductId] = useState<string | null>(null);

  // Start a new sale for a product (creates company_product with in_sales status)
  const handleStartSale = async (productId: string) => {
    setStartingSaleProductId(productId);
    try {
      const response = await fetch(`/api/companies/${company.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          status: 'in_sales',
        }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to start sale');
      }
    } catch (error) {
      console.error('Error starting sale:', error);
      alert('Failed to start sale');
    } finally {
      setStartingSaleProductId(null);
    }
  };

  // Sync tab with URL
  useEffect(() => {
    if (tabFromUrl && tabs.some(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Fetch relationship intelligence when tab is active
  useEffect(() => {
    if (activeTab === 'relationship' && !relationshipData && !relationshipLoading) {
      fetchRelationshipData();
    }
  }, [activeTab]);

  const fetchRelationshipData = async () => {
    setRelationshipLoading(true);
    try {
      const response = await fetch(`/api/companies/${company.id}/intelligence`);
      if (response.ok) {
        const data = await response.json();
        setRelationshipData(data);
      }
    } catch (err) {
      console.error('Error fetching relationship intelligence:', err);
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleRefreshSummary = async () => {
    setRefreshingSummary(true);
    try {
      // Trigger AI to regenerate the summary
      await fetch(`/api/companies/${company.id}/intelligence/refresh-summary`, {
        method: 'POST',
      });
      await fetchRelationshipData();
    } catch (err) {
      console.error('Error refreshing summary:', err);
    } finally {
      setRefreshingSummary(false);
    }
  };

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/companies/${company.id}?tab=${tabId}`, { scroll: false });
  };

  const status = statusConfig[company.status] || statusConfig.cold_lead;
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const closedWonDeals = deals.filter(d => d.stage === 'closed_won');
  const closedLostDeals = deals.filter(d => d.stage === 'closed_lost');

  // Calculate MRR from active products
  const totalMRR = companyProducts
    .filter(cp => cp.status === 'active')
    .reduce((sum, cp) => sum + (cp.mrr || 0), 0);

  // Group company products by status for Current Stack display
  const activeProducts = companyProducts.filter((cp: any) => cp.status === 'active');
  const inSalesProducts = companyProducts.filter((cp: any) => cp.status === 'in_sales');
  const inOnboardingProducts = companyProducts.filter((cp: any) => cp.status === 'in_onboarding');
  const otherProducts = companyProducts.filter((cp: any) =>
    ['inactive', 'declined', 'churned'].includes(cp.status)
  );

  // Get products not yet in company_products (available for selling)
  const ownedProductIds = new Set(companyProducts.map((cp: any) => cp.product_id));
  const availableProducts = allProducts.filter((p: any) => !ownedProductIds.has(p.id));

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
                  {company.industry && industryLabels[company.industry] && (
                    <span className={cn(
                      'text-sm font-medium px-2.5 py-0.5 rounded-full',
                      industryLabels[company.industry].color
                    )}>
                      {industryLabels[company.industry].label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {parseAddress(company.address) && (
                    <>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {parseAddress(company.address)}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span>{company.employee_range || company.agent_count} employees</span>
                  <span>•</span>
                  <span>{segmentLabels[company.segment]}</span>
                  {(company.vfp_customer_id || company.ats_id) && (
                    <>
                      <span>•</span>
                      <span className="text-gray-400">
                        {company.vfp_customer_id && `Rev #${company.vfp_customer_id}`}
                        {company.vfp_customer_id && company.ats_id && ' / '}
                        {company.ats_id && `ATS #${company.ats_id}`}
                      </span>
                    </>
                  )}
                  {company.crm_platform && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{company.crm_platform}</span>
                    </>
                  )}
                </div>
                {company.vfp_support_contact && (
                  <p className="text-sm text-gray-500 mt-1">
                    Success Rep: {company.vfp_support_contact}
                  </p>
                )}
                {primaryContact && (
                  <p className="text-sm text-gray-500 mt-1">
                    Primary: {primaryContact.name}
                    {primaryContact.email && ` (${primaryContact.email})`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFlagModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100"
              >
                <Flag className="h-4 w-4" />
                Flag
              </button>
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
              onClick={() => handleTabChange(tab.id)}
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
          <div className="grid grid-cols-2 gap-6">
          {/* Intelligence Overview Panel */}
          <IntelligenceOverviewPanel companyId={company.id} companyName={company.name} />
          {/* Panel 1: Current Stack */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Current Stack</h2>
              <span className="text-sm text-gray-500">
                MRR: <span className="font-medium text-green-600">{formatCurrency(totalMRR)}</span>
              </span>
            </div>
            <div className="space-y-4">
              {/* Active Products */}
              {activeProducts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Active ({activeProducts.length})
                  </h3>
                  <div className="space-y-2">
                    {activeProducts.map((cp: any) => (
                      <div key={cp.id} className="flex items-center gap-2 text-sm text-gray-900">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="flex-1">{cp.product?.name}</span>
                        {cp.tier && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {cp.tier.name}
                          </span>
                        )}
                        {cp.mrr > 0 && (
                          <span className="text-gray-500">{formatCurrency(cp.mrr)}/mo</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In Onboarding */}
              {inOnboardingProducts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <PlayCircle className="h-3 w-3" />
                    Onboarding ({inOnboardingProducts.length})
                  </h3>
                  <div className="space-y-2">
                    {inOnboardingProducts.map((cp: any) => (
                      <div key={cp.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <PlayCircle className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="flex-1">{cp.product?.name}</span>
                        {cp.tier && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            {cp.tier.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In Sales Pipeline */}
              {inSalesProducts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    In Sales ({inSalesProducts.length})
                  </h3>
                  <div className="space-y-2">
                    {inSalesProducts.map((cp: any) => (
                      <div key={cp.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <TrendingUp className="h-4 w-4 text-purple-500 shrink-0" />
                        <span className="flex-1">{cp.product?.name}</span>
                        {cp.current_stage && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                            {cp.current_stage.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {activeProducts.length === 0 && inOnboardingProducts.length === 0 && inSalesProducts.length === 0 && (
                <p className="text-sm text-gray-400 italic text-center py-4">No products yet</p>
              )}
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
                        {signal.product?.id && (
                          <button
                            onClick={() => handleStartSale(signal.product.id)}
                            disabled={startingSaleProductId === signal.product.id}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                          >
                            {startingSaleProductId === signal.product.id ? 'Starting...' : 'Start Sale'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products not yet pitched */}
            {availableProducts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Available to Sell
                </h3>
                <div className="space-y-1">
                  {availableProducts.slice(0, 3).map((product: any) => (
                    <div key={product.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-600">{product.name}</span>
                      <button
                        onClick={() => handleStartSale(product.id)}
                        disabled={startingSaleProductId === product.id}
                        className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        {startingSaleProductId === product.id ? 'Starting...' : 'Start Sale'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {activeTab === 'relationship' && (
        <div className="space-y-6">
          {relationshipLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ) : relationshipData ? (
            <>
              {/* Relationship Summary */}
              <RelationshipSummaryCard
                summary={relationshipData.relationshipIntelligence?.context_summary || null}
                updatedAt={relationshipData.relationshipIntelligence?.context_summary_updated_at || null}
                healthScore={relationshipData.relationshipIntelligence?.health_score || null}
                interactionCount={relationshipData.relationshipIntelligence?.interaction_count || 0}
                lastInteractionAt={relationshipData.relationshipIntelligence?.last_interaction_at || null}
                onRefreshSummary={handleRefreshSummary}
                isRefreshing={refreshingSummary}
              />

              {/* Two column layout for key data */}
              <div className="grid grid-cols-2 gap-6">
                {/* Stakeholder Map */}
                <StakeholderMap
                  stakeholders={relationshipData.relationshipIntelligence?.context?.stakeholders || []}
                  contacts={relationshipData.contacts}
                  onContactClick={(id) => router.push(`/contacts/${id}`)}
                />

                {/* Active Actions */}
                <ActiveActionsPanel
                  actions={relationshipData.activeActions || []}
                  onActionClick={(id) => router.push(`/command-center?action=${id}`)}
                />
              </div>

              {/* Signals Panel */}
              <SignalsPanel
                buyingSignals={relationshipData.relationshipIntelligence?.context?.buying_signals || []}
                concerns={relationshipData.relationshipIntelligence?.context?.concerns || []}
                objections={relationshipData.relationshipIntelligence?.context?.objections || []}
              />

              {/* Key Facts */}
              <KeyFactsPanel
                facts={relationshipData.relationshipIntelligence?.context?.facts || []}
              />

              {/* Communication Timeline */}
              <CommunicationTimeline
                interactions={relationshipData.relationshipIntelligence?.context?.interactions || []}
              />
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-500">
                No relationship intelligence available yet. This will be populated as you interact with the company through emails and meetings.
              </p>
            </div>
          )}
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
                <ContactCardWithFacts
                  key={contact.id}
                  contact={contact}
                  companyName={company.name}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No contacts yet</p>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Current Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Product Portfolio</h2>
              <span className="text-sm text-gray-500">
                Total MRR: <span className="font-medium text-green-600">{formatCurrency(totalMRR)}</span>
              </span>
            </div>

            {companyProducts.length > 0 ? (
              <div className="space-y-3">
                {companyProducts.map((cp: any) => {
                  const statusConfig = productStatusConfig[cp.status] || productStatusConfig.inactive;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div
                      key={cp.id}
                      className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <StatusIcon className={cn('h-5 w-5 mt-0.5', statusConfig.color)} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {cp.product?.name}
                              </span>
                              {cp.tier && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                  {cp.tier.name}
                                </span>
                              )}
                              {cp.seats && (
                                <span className="text-xs text-gray-500">
                                  {cp.seats} seat{cp.seats !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            {cp.current_stage && (
                              <p className="text-sm text-purple-600 mt-0.5">
                                Stage: {cp.current_stage.name}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              {cp.status === 'active' && cp.activated_at && (
                                <span>Active since {formatDate(cp.activated_at)}</span>
                              )}
                              {cp.status === 'in_sales' && cp.sales_started_at && (
                                <span>Started {formatDate(cp.sales_started_at)}</span>
                              )}
                              {cp.status === 'in_onboarding' && cp.onboarding_started_at && (
                                <span>Onboarding since {formatDate(cp.onboarding_started_at)}</span>
                              )}
                              {cp.status === 'churned' && cp.churned_at && (
                                <span>Churned {formatDate(cp.churned_at)}</span>
                              )}
                              {cp.status === 'declined' && cp.declined_at && (
                                <span>Declined {formatDate(cp.declined_at)}</span>
                              )}
                              {cp.owner && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {cp.owner.name}
                                </span>
                              )}
                            </div>
                            {cp.declined_reason && (
                              <p className="text-sm text-orange-600 mt-1">
                                Reason: {cp.declined_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {cp.mrr > 0 && (
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(cp.mrr)}/mo
                            </span>
                          )}
                          <button
                            onClick={() => setEditingCompanyProduct(cp)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <span className={cn(
                            'text-xs font-medium px-2 py-1 rounded-full',
                            statusConfig.bgColor,
                            statusConfig.color
                          )}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No products associated with this company</p>
            )}
          </div>

          {/* Available Products */}
          {availableProducts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Available Products</h2>
              <div className="grid grid-cols-2 gap-3">
                {availableProducts.map((product: any) => {
                  const typeConfig = productTypeIcons[product.product_type] || productTypeIcons.suite;
                  const TypeIcon = typeConfig.icon;
                  return (
                    <div
                      key={product.id}
                      className="p-4 rounded-lg border border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <TypeIcon className={cn('h-5 w-5 mt-0.5', typeConfig.color)} />
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                {product.description}
                              </p>
                            )}
                            {product.tiers && product.tiers.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                {product.tiers
                                  .sort((a: any, b: any) => a.display_order - b.display_order)
                                  .map((tier: any) => (
                                    <span
                                      key={tier.id}
                                      className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                    >
                                      {tier.name}
                                      {tier.price_monthly && ` $${tier.price_monthly}`}
                                    </span>
                                  ))}
                              </div>
                            )}
                            {product.base_price_monthly && !product.tiers?.length && (
                              <p className="text-sm text-gray-500 mt-1">
                                ${product.base_price_monthly}/mo
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartSale(product.id)}
                          disabled={startingSaleProductId === product.id}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap disabled:opacity-50"
                        >
                          {startingSaleProductId === product.id ? 'Starting...' : 'Start Sale'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'memory' && (
        <AccountMemoryPanel companyId={company.id} companyName={company.name} />
      )}

      {activeTab === 'research' && (
        <CompanyResearchTab companyId={company.id} companyName={company.name} />
      )}

      {/* Quick Flag Modal */}
      <QuickFlagModal
        isOpen={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        companyId={company.id}
        companyName={company.name}
      />

      {/* Edit Company Product Modal */}
      {editingCompanyProduct && (
        <EditCompanyProductModal
          companyId={company.id}
          companyProduct={editingCompanyProduct}
          productInfo={allProducts.find((p: any) => p.id === editingCompanyProduct.product_id)}
          onClose={() => setEditingCompanyProduct(null)}
          onSaved={() => {
            setEditingCompanyProduct(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// Edit Company Product Modal
function EditCompanyProductModal({
  companyId,
  companyProduct,
  productInfo,
  onClose,
  onSaved,
}: {
  companyId: string;
  companyProduct: any;
  productInfo?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: companyProduct.status,
    tier_id: companyProduct.tier?.id || companyProduct.tier_id || '',
    current_stage_id: companyProduct.current_stage?.id || companyProduct.current_stage_id || '',
    mrr: companyProduct.mrr?.toString() || '',
    seats: companyProduct.seats?.toString() || '',
    notes: companyProduct.notes || '',
  });

  const statusOptions = [
    { value: 'inactive', label: 'Inactive' },
    { value: 'in_sales', label: 'In Sales' },
    { value: 'in_onboarding', label: 'Onboarding' },
    { value: 'active', label: 'Active' },
    { value: 'declined', label: 'Declined' },
    { value: 'churned', label: 'Churned' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/companies/${companyId}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_product_id: companyProduct.id,
          status: formData.status,
          tier_id: formData.tier_id || null,
          current_stage_id: formData.current_stage_id || null,
          mrr: formData.mrr || null,
          seats: formData.seats ? parseInt(formData.seats) : null,
          notes: formData.notes || null,
        }),
      });

      if (response.ok) {
        onSaved();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update');
      }
    } catch (error) {
      alert('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const tiers = productInfo?.tiers || [];
  const stages = (productInfo?.stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium text-gray-900">
            Edit {companyProduct.product?.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tier (if available) */}
          {tiers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tier
              </label>
              <select
                value={formData.tier_id}
                onChange={(e) => setFormData({ ...formData, tier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No tier selected</option>
                {tiers.map((tier: any) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stage (if in_sales) */}
          {formData.status === 'in_sales' && stages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pipeline Stage
              </label>
              <select
                value={formData.current_stage_id}
                onChange={(e) => setFormData({ ...formData, current_stage_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select stage</option>
                {stages.map((stage: any) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MRR */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              MRR ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.mrr}
              onChange={(e) => setFormData({ ...formData, mrr: e.target.value })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Seats */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seats
            </label>
            <input
              type="number"
              value={formData.seats}
              onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
