'use client';

import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, Calendar, DollarSign, Phone, Zap, Bot, User } from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { getHealthScoreColor, getHealthScoreLabel, type Deal, type SalesTeam } from '@/types';

interface DealCardProps {
  deal: Deal;
}

const teamConfig: Record<SalesTeam, { label: string; color: string }> = {
  voice_outside: { label: 'Voice Out', color: 'bg-purple-100 text-purple-700' },
  voice_inside: { label: 'Voice In', color: 'bg-purple-50 text-purple-600' },
  xrai: { label: 'X-RAI', color: 'bg-blue-100 text-blue-700' },
};

const productBadges: Record<string, { icon: any; color: string; label: string }> = {
  voice: { icon: Phone, color: 'bg-purple-100 text-purple-600', label: 'Voice' },
  platform: { icon: Zap, color: 'bg-blue-100 text-blue-600', label: 'X-RAI' },
};

export function DealCard({ deal }: DealCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if it wasn't a drag
    if (!isDragging) {
      router.push(`/deals/${deal.id}`);
    }
  };

  // Get active products from deal
  const activeProducts = [];
  if (deal.products?.voice) activeProducts.push('voice');
  if (deal.products?.platform) activeProducts.push('platform');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="block">
        {/* Company name at top */}
        {deal.company && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
            <Building2 className="h-3 w-3" />
            <span className="truncate font-medium">{deal.company.name}</span>
          </div>
        )}

        {/* Deal name and health score */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
            {deal.name}
          </h3>
          <div
            className={cn(
              'shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full',
              getHealthScoreColor(deal.health_score),
              deal.health_score >= 80 && 'bg-green-100',
              deal.health_score >= 60 && deal.health_score < 80 && 'bg-yellow-100',
              deal.health_score >= 40 && deal.health_score < 60 && 'bg-orange-100',
              deal.health_score < 40 && 'bg-red-100'
            )}
            title={getHealthScoreLabel(deal.health_score)}
          >
            {deal.health_score}
          </div>
        </div>

        {/* Owner */}
        {deal.owner && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <User className="h-3 w-3" />
            <span>{deal.owner.name}</span>
          </div>
        )}

        {/* Value and close date row */}
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1 text-gray-900 font-medium">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            {formatCurrency(deal.estimated_value)}
          </div>

          {deal.expected_close_date && (
            <div className="flex items-center gap-1 text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              {formatRelativeTime(deal.expected_close_date)}
            </div>
          )}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Team badge */}
          {deal.sales_team && teamConfig[deal.sales_team] && (
            <span className={cn(
              'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded',
              teamConfig[deal.sales_team].color
            )}>
              {teamConfig[deal.sales_team].label}
            </span>
          )}

          {/* Product badges */}
          {activeProducts.map(productKey => {
            const config = productBadges[productKey];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <span
                key={productKey}
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded',
                  config.color
                )}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </span>
            );
          })}

          {/* Trial indicator */}
          {deal.stage === 'trial' && deal.trial_start_date && (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
              Trial Day {Math.floor((Date.now() - new Date(deal.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
