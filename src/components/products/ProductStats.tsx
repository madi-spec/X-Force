'use client';

import { Users, TrendingUp, DollarSign, Target, Clock, UserX } from 'lucide-react';

interface ProductStatsProps {
  stats: {
    active: number;
    in_sales: number;
    in_onboarding: number;
    inactive: number;
    total_mrr: number;
  };
}

export function ProductStats({ stats }: ProductStatsProps) {
  return (
    <div className="grid grid-cols-6 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Target className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.in_sales}</div>
            <div className="text-sm text-gray-500">In Sales</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.in_onboarding}</div>
            <div className="text-sm text-gray-500">Onboarding</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <UserX className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.inactive}</div>
            <div className="text-sm text-gray-500">Inactive</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              ${stats.total_mrr.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">MRR</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              ${Math.round(stats.total_mrr / Math.max(stats.active, 1)).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Avg MRR</div>
          </div>
        </div>
      </div>
    </div>
  );
}
