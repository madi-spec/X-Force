'use client';

import { Users, TrendingUp, DollarSign, Target } from 'lucide-react';

interface WhitespaceStatsProps {
  stats: {
    total_vfp_customers: number;
    customers_with_ai_products: number;
    customers_without_ai_products: number;
    adoption_rate: number;
    total_whitespace_mrr: number;
  };
}

export function WhitespaceStats({ stats }: WhitespaceStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        value={stats.total_vfp_customers.toLocaleString()}
        label="VFP Customers"
      />
      <StatCard
        icon={TrendingUp}
        iconBg="bg-green-100"
        iconColor="text-green-600"
        value={`${stats.adoption_rate}%`}
        label="AI Adoption Rate"
        subtext={`${stats.customers_with_ai_products} with AI products`}
      />
      <StatCard
        icon={Target}
        iconBg="bg-yellow-100"
        iconColor="text-yellow-600"
        value={stats.customers_without_ai_products.toLocaleString()}
        label="Untapped Customers"
        subtext="No AI products yet"
      />
      <StatCard
        icon={DollarSign}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        value={`$${(stats.total_whitespace_mrr / 1000).toFixed(0)}k`}
        label="Whitespace MRR"
        subtext="Potential monthly revenue"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  subtext
}: {
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
          {subtext && <div className="text-xs text-gray-400">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}
