'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Package,
  Target,
  Rocket,
  Ticket,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';
import { ProcessCategory, PROCESS_CATEGORIES } from '@/lib/process';

interface ProcessScaffoldProps {
  productSlug: string;
  productName: string;
  productColor: string | null;
  processType: ProcessCategory;
}

const iconMap: Record<string, typeof Target> = {
  Target,
  Rocket,
  Ticket,
  HeartHandshake,
};

// Example stages for each process type
const scaffoldData: Record<ProcessCategory, { stages: { name: string; description: string }[]; features: string[] }> = {
  sales: {
    stages: [],
    features: [],
  },
  onboarding: {
    stages: [
      { name: 'Kickoff', description: 'Initial meeting and goals alignment' },
      { name: 'Setup', description: 'System configuration and integration' },
      { name: 'Training', description: 'User training and documentation' },
      { name: 'Go Live', description: 'Production deployment and monitoring' },
      { name: 'Handoff', description: 'Transition to Customer Success' },
    ],
    features: [
      'Milestone tracking with SLAs',
      'Required tasks per milestone',
      'Success criteria validation',
      'Progress notifications',
      'Stakeholder assignments',
    ],
  },
  support: {
    stages: [
      { name: 'Critical (P1)', description: 'System down, no workaround - 1hr response' },
      { name: 'High (P2)', description: 'Major impact, workaround exists - 4hr response' },
      { name: 'Medium (P3)', description: 'Moderate impact - 8hr response' },
      { name: 'Low (P4)', description: 'Minor issue or question - 24hr response' },
    ],
    features: [
      'Severity-based SLA definitions',
      'Escalation rules and triggers',
      'Auto-assignment by expertise',
      'Response time tracking',
      'Resolution templates',
    ],
  },
  engagement: {
    stages: [
      { name: 'Healthy (80-100)', description: 'Proactive outreach, expansion focus' },
      { name: 'Stable (60-79)', description: 'Regular check-ins, feature adoption' },
      { name: 'At Risk (40-59)', description: 'Intervention required, QBR planning' },
      { name: 'Critical (<40)', description: 'Escalation, executive engagement' },
    ],
    features: [
      'Health score triggers',
      'Recommended actions per tier',
      'Automated playbook execution',
      'Expansion opportunity detection',
      'Churn risk prediction',
    ],
  },
};

export function ProcessScaffold({
  productSlug,
  productName,
  productColor,
  processType,
}: ProcessScaffoldProps) {
  const category = PROCESS_CATEGORIES.find((c) => c.id === processType);
  if (!category) return null;

  const Icon = iconMap[category.icon] || Target;
  const data = scaffoldData[processType];

  return (
    <div>
      {/* Back Link */}
      <Link
        href={`/process/${productSlug}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {productName} Processes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: productColor || '#6B7280' }}
          >
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-normal text-gray-900">{category.label}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {productName} · {category.description}
            </p>
          </div>
        </div>
      </div>

      {/* Process Overview */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-8 mb-8">
        <div className="flex items-start gap-4">
          <div className={cn('p-4 rounded-xl', category.bgColor)}>
            <Icon className={cn('h-8 w-8', category.color)} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              {category.label} for {productName}
            </h2>
            <p className="text-sm text-gray-600 max-w-xl">
              {processType === 'support' ? 'Define severity levels, SLAs, and escalation rules for support cases.' :
                processType === 'onboarding' ? 'Configure onboarding milestones, tasks, and success criteria.' :
                processType === 'engagement' ? 'Set up health-based actions and expansion triggers.' :
                'Configure process stages and automation rules.'}
            </p>
          </div>
        </div>
      </div>

      {/* Preview of What's Coming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Example Stages/Levels */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">
              {processType === 'support' ? 'Severity Levels' :
               processType === 'engagement' ? 'Health Tiers' :
               'Milestones'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Example structure</p>
          </div>
          <div className="p-4 space-y-3">
            {data.stages.map((stage, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  category.bgColor
                )}>
                  <span className={cn('text-sm font-medium', category.color)}>
                    {idx + 1}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Preview */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">Planned Features</h3>
            <p className="text-xs text-gray-500 mt-0.5">What you&apos;ll be able to configure</p>
          </div>
          <div className="p-4 space-y-2">
            {data.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Ready to configure?</h3>
            <p className="text-sm text-gray-500">
              Use the structure above as a starting point for your {processType} playbook.
            </p>
          </div>
          <Link
            href="/process"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Process Studio
          </Link>
        </div>
      </div>
    </div>
  );
}
