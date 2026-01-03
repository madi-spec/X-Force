'use client';

import { cn } from '@/lib/utils';
import {
  Rocket,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Package,
  ArrowRight,
  PlayCircle,
  Circle,
} from 'lucide-react';
import { CustomerHubData, CompanyProduct } from '../types';

interface OnboardingTabProps {
  data: CustomerHubData;
}

function OnboardingProductCard({ product }: { product: CompanyProduct }) {
  const stageOrder = product.current_stage?.stage_order || 0;

  // Mock stages - in production these would come from product_process_stages
  const stages = [
    { name: 'Kickoff', order: 1 },
    { name: 'Setup', order: 2 },
    { name: 'Training', order: 3 },
    { name: 'Go-Live', order: 4 },
    { name: 'Complete', order: 5 },
  ];

  const currentStageIndex = stages.findIndex(s => s.name === product.current_stage?.name);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Package className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{product.product?.name || 'Unknown Product'}</h4>
            <p className="text-sm text-gray-500">{product.tier?.name || 'No tier'}</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-700">
          {product.current_stage?.name || 'Not Started'}
        </span>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {stages.map((stage, idx) => {
            const isComplete = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;

            return (
              <div key={stage.name} className="flex flex-col items-center relative z-10">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center',
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isCurrent ? (
                    <PlayCircle className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <p className={cn(
                  'text-xs mt-2 text-center',
                  isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'
                )}>
                  {stage.name}
                </p>
              </div>
            );
          })}
        </div>
        {/* Progress line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 -z-0">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">
            {product.started_at ? Math.ceil((Date.now() - new Date(product.started_at).getTime()) / (1000 * 60 * 60 * 24)) : '-'}
          </p>
          <p className="text-xs text-gray-500">Days in Onboarding</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">{product.owner?.name?.split(' ')[0] || '-'}</p>
          <p className="text-xs text-gray-500">Owner</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">-</p>
          <p className="text-xs text-gray-500">Target Go-Live</p>
        </div>
      </div>
    </div>
  );
}

export function OnboardingTab({ data }: OnboardingTabProps) {
  const { companyProducts, contacts } = data;

  const onboardingProducts = companyProducts.filter(p => p.status === 'in_onboarding');
  const activeProducts = companyProducts.filter(p => p.status === 'active');
  const totalProducts = onboardingProducts.length + activeProducts.length;

  // Find key contacts for onboarding
  const keyContacts = contacts.filter(c => c.is_decision_maker || c.is_primary).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">In Progress</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{onboardingProducts.length}</p>
          <p className="text-xs text-gray-500 mt-1">products onboarding</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Activated</span>
          </div>
          <p className="text-2xl font-light text-green-600">{activeProducts.length}</p>
          <p className="text-xs text-gray-500 mt-1">products live</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Avg Time</span>
          </div>
          <p className="text-2xl font-light text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-1">days to activate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Key Contacts</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{keyContacts.length}</p>
          <p className="text-xs text-gray-500 mt-1">stakeholders</p>
        </div>
      </div>

      {/* Active Onboarding */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Active Onboarding</h3>
        {onboardingProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Rocket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products currently onboarding</p>
            {activeProducts.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                {activeProducts.length} product{activeProducts.length > 1 ? 's' : ''} already active
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {onboardingProducts.map((product) => (
              <OnboardingProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Key Stakeholders */}
      {keyContacts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Key Stakeholders</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {keyContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                  <p className="text-xs text-gray-500 truncate">{contact.title || contact.email}</p>
                </div>
                {contact.is_primary && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs shrink-0">Primary</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Onboarding */}
      {activeProducts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4">Completed Onboarding</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.tier?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {product.activated_at ? new Date(product.activated_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {product.health_score != null && !isNaN(Number(product.health_score)) ? (
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          Number(product.health_score) >= 80 ? 'bg-green-100 text-green-700' :
                          Number(product.health_score) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {Math.round(Number(product.health_score))}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
