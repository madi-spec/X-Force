'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useLens } from '@/lib/lens';
import {
  ArrowLeft,
  Building2,
  Heart,
  Calendar,
  DollarSign,
  Ticket,
  TrendingUp,
  User,
  AlertTriangle,
  Clock,
  Target,
  Rocket,
  CheckCircle,
  XCircle,
  MoreHorizontal,
} from 'lucide-react';
import { CustomerHubData, HeaderChipConfig } from './types';

interface CustomerHubHeaderProps {
  data: CustomerHubData;
  className?: string;
}

// Status configuration
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  cold_lead: { label: 'Lead', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  prospect: { label: 'Prospect', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  customer: { label: 'Customer', color: 'text-green-700', bgColor: 'bg-green-100' },
  churned: { label: 'Churned', color: 'text-red-700', bgColor: 'bg-red-100' },
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDays(days: number | null): string {
  if (days === null) return '-';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  return `${days}d`;
}

function getHealthColor(score: number | null): { color: string; bgColor: string } {
  if (score === null) return { color: 'text-gray-500', bgColor: 'bg-gray-100' };
  if (score >= 80) return { color: 'text-green-700', bgColor: 'bg-green-100' };
  if (score >= 60) return { color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  return { color: 'text-red-700', bgColor: 'bg-red-100' };
}

export function CustomerHubHeader({ data, className }: CustomerHubHeaderProps) {
  const { config: lensConfig, currentLens } = useLens();
  const { company, stats, companyProducts, supportCases } = data;

  // Build all available chips
  const allChips = useMemo<HeaderChipConfig[]>(() => {
    const chips: HeaderChipConfig[] = [];

    // Health chip
    const healthColors = getHealthColor(stats.healthScore);
    chips.push({
      id: 'health',
      label: 'Health',
      value: stats.healthScore !== null ? `${Math.round(stats.healthScore)}` : null,
      color: healthColors.color,
      bgColor: healthColors.bgColor,
      icon: 'Heart',
    });

    // MRR chip
    chips.push({
      id: 'mrr',
      label: 'MRR',
      value: formatCurrency(stats.totalMrr),
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      icon: 'DollarSign',
    });

    // Renewal chip
    chips.push({
      id: 'renewal',
      label: 'Renewal',
      value: stats.renewalDays !== null ? formatDays(stats.renewalDays) : null,
      color: stats.renewalDays !== null && stats.renewalDays <= 30 ? 'text-amber-700' : 'text-gray-700',
      bgColor: stats.renewalDays !== null && stats.renewalDays <= 30 ? 'bg-amber-100' : 'bg-gray-100',
      icon: 'Calendar',
    });

    // Open Cases chip
    chips.push({
      id: 'open_cases',
      label: 'Cases',
      value: stats.openCases > 0 ? `${stats.openCases} open` : '0',
      color: stats.openCases > 0 ? 'text-orange-700' : 'text-gray-500',
      bgColor: stats.openCases > 0 ? 'bg-orange-100' : 'bg-gray-100',
      icon: 'Ticket',
    });

    // SLA Status chip - check if any open cases have SLA breach
    const hasSlaBreached = supportCases.some(c =>
      !['resolved', 'closed'].includes(c.status) && c.sla_breached
    );
    chips.push({
      id: 'sla_status',
      label: 'SLA',
      value: hasSlaBreached ? 'Breach' : 'OK',
      color: hasSlaBreached ? 'text-red-700' : 'text-green-700',
      bgColor: hasSlaBreached ? 'bg-red-100' : 'bg-green-100',
      icon: hasSlaBreached ? 'AlertTriangle' : 'CheckCircle',
    });

    // Severity (highest from open cases)
    const severities = supportCases
      .filter(c => !['resolved', 'closed'].includes(c.status))
      .map(c => c.severity);
    const highestSeverity = severities.includes('critical') ? 'Critical' :
                           severities.includes('urgent') ? 'Urgent' :
                           severities.includes('high') ? 'High' :
                           severities.length > 0 ? 'Normal' : null;
    chips.push({
      id: 'severity',
      label: 'Severity',
      value: highestSeverity,
      color: highestSeverity === 'Critical' || highestSeverity === 'Urgent' ? 'text-red-700' :
             highestSeverity === 'High' ? 'text-orange-700' : 'text-gray-700',
      bgColor: highestSeverity === 'Critical' || highestSeverity === 'Urgent' ? 'bg-red-100' :
               highestSeverity === 'High' ? 'bg-orange-100' : 'bg-gray-100',
      icon: 'AlertTriangle',
    });

    // Last Contact chip
    chips.push({
      id: 'last_contact',
      label: 'Last Contact',
      value: stats.daysSinceContact !== null ? `${stats.daysSinceContact}d ago` : null,
      color: stats.daysSinceContact !== null && stats.daysSinceContact > 14 ? 'text-amber-700' : 'text-gray-700',
      bgColor: stats.daysSinceContact !== null && stats.daysSinceContact > 14 ? 'bg-amber-100' : 'bg-gray-100',
      icon: 'Clock',
    });

    // Stage chip (for sales lens - use first product in_sales)
    const salesProduct = companyProducts.find(p => p.status === 'in_sales');
    chips.push({
      id: 'stage',
      label: 'Stage',
      value: salesProduct?.current_stage?.name || null,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      icon: 'Target',
    });

    // Deal Value chip (sum of products in_sales)
    const salesValue = companyProducts
      .filter(p => p.status === 'in_sales')
      .reduce((sum, p) => sum + (p.mrr || 0), 0);
    chips.push({
      id: 'deal_value',
      label: 'Deal Value',
      value: salesValue > 0 ? formatCurrency(salesValue * 12) : null,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      icon: 'DollarSign',
    });

    // Close Date chip (placeholder - would come from product data)
    chips.push({
      id: 'close_date',
      label: 'Close Date',
      value: null,
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      icon: 'Calendar',
    });

    // Owner chip - get from first product with owner
    const productWithOwner = companyProducts.find(p => p.owner?.name);
    chips.push({
      id: 'owner',
      label: 'Owner',
      value: productWithOwner?.owner?.name || null,
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      icon: 'User',
    });

    // Expansion chip
    const expansionOpportunities = companyProducts.filter(
      p => p.status === 'active' && (p.tier?.price_monthly || 0) < 500
    ).length;
    chips.push({
      id: 'expansion',
      label: 'Expansion',
      value: expansionOpportunities > 0 ? `${expansionOpportunities} opps` : null,
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
      icon: 'TrendingUp',
    });

    // Onboarding Stage chip
    const onboardingProduct = companyProducts.find(p => p.status === 'in_onboarding');
    chips.push({
      id: 'onboarding_stage',
      label: 'Onboarding',
      value: onboardingProduct?.current_stage?.name || null,
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
      icon: 'Rocket',
    });

    // Go-Live Date chip (placeholder)
    chips.push({
      id: 'go_live_date',
      label: 'Go-Live',
      value: null,
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      icon: 'Calendar',
    });

    // Activation Progress chip
    const onboardingProducts = companyProducts.filter(p => p.status === 'in_onboarding');
    const activatedProducts = companyProducts.filter(p => p.status === 'active');
    const totalProducts = onboardingProducts.length + activatedProducts.length;
    chips.push({
      id: 'activation_progress',
      label: 'Activated',
      value: totalProducts > 0 ? `${activatedProducts.length}/${totalProducts}` : null,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      icon: 'CheckCircle',
    });

    return chips;
  }, [company, stats, companyProducts, supportCases]);

  // Filter chips based on lens
  const visibleChips = useMemo(() => {
    return allChips.filter(chip => {
      // Hide chips explicitly hidden for this lens
      if (lensConfig.hiddenHeaderChips.includes(chip.id)) return false;
      // Only show chips that have a value
      if (chip.value === null) return false;
      return true;
    });
  }, [allChips, lensConfig.hiddenHeaderChips]);

  // Primary chips (emphasized) vs secondary
  const primaryChips = visibleChips.filter(chip => lensConfig.headerChips.includes(chip.id));
  const secondaryChips = visibleChips.filter(chip => !lensConfig.headerChips.includes(chip.id));

  const status = statusConfig[company.status || 'cold_lead'] || statusConfig.cold_lead;

  const iconMap: Record<string, typeof Heart> = {
    Heart,
    DollarSign,
    Calendar,
    Ticket,
    TrendingUp,
    User,
    AlertTriangle,
    Clock,
    Target,
    Rocket,
    CheckCircle,
    XCircle,
  };

  return (
    <div className={cn('bg-white border-b border-gray-200', className)}>
      {/* Top row: Back + Company identity */}
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/customers"
              className="mt-1 p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-medium text-gray-900">{company.name}</h1>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', status.bgColor, status.color)}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {company.domain && <span>{company.domain}</span>}
                  {company.segment && (
                    <span className="capitalize">{company.segment.replace('_', ' ')}</span>
                  )}
                  {company.industry && (
                    <span className="capitalize">{company.industry}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lens indicator */}
          <div className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', lensConfig.bgColor, lensConfig.color)}>
            {lensConfig.label} View
          </div>
        </div>
      </div>

      {/* Chips row */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary chips (emphasized) */}
          {primaryChips.map((chip) => {
            const Icon = iconMap[chip.icon || 'Heart'] || Heart;
            return (
              <div
                key={chip.id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                  chip.bgColor,
                  chip.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-gray-500 font-normal">{chip.label}:</span>
                <span>{chip.value}</span>
              </div>
            );
          })}

          {/* Separator if we have secondary chips */}
          {secondaryChips.length > 0 && primaryChips.length > 0 && (
            <div className="h-6 w-px bg-gray-200 mx-1" />
          )}

          {/* Secondary chips (muted) */}
          {secondaryChips.slice(0, 3).map((chip) => {
            const Icon = iconMap[chip.icon || 'Heart'] || Heart;
            return (
              <div
                key={chip.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-500 bg-gray-50"
              >
                <Icon className="h-3 w-3" />
                <span>{chip.label}:</span>
                <span className="text-gray-700">{chip.value}</span>
              </div>
            );
          })}

          {/* More chips indicator */}
          {secondaryChips.length > 3 && (
            <button className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="h-3 w-3" />
              <span>+{secondaryChips.length - 3} more</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
