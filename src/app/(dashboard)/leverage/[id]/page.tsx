'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  UserPlus,
  Swords,
  DollarSign,
  Clock,
  Target,
  CheckCircle,
  X,
  AlertTriangle,
  Lightbulb,
  Ban,
  TrendingUp,
  Building2,
  User,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface LeverageMoment {
  id: string;
  type: string;
  urgency: string;
  required_role: string;
  confidence: number;
  confidence_low: number;
  confidence_high: number;
  confidence_label: string;
  confidence_factors: string[];
  trust_basis: {
    historicalAccuracy: number;
    accuracyLabel: string;
    similarOutcomes: string;
    signalSources: string[];
    dataPoints: Array<{ label: string; value: string }>;
    sampleSize: number;
  };
  situation: string;
  why_it_matters: string;
  what_ai_did: string;
  what_human_must_do: string;
  why_human: string;
  talking_points: string[];
  data_points: Array<{ label: string; value: string }>;
  avoid: string[];
  success_criteria: string;
  if_unsuccessful: string;
  status: string;
  created_at: string;
  company: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
    estimated_value: number;
    expected_close_date: string | null;
  } | null;
  contact: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

// ============================================
// CONFIGURATION
// ============================================

const typeConfig: Record<string, { label: string; icon: typeof Phone; color: string; bgColor: string }> = {
  relationship_repair: {
    label: 'Relationship Repair',
    icon: Phone,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  exec_intro: {
    label: 'Executive Introduction',
    icon: UserPlus,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  competitive_threat: {
    label: 'Competitive Threat',
    icon: Swords,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
  pricing_exception: {
    label: 'Pricing Exception',
    icon: DollarSign,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  immediate: { label: 'Immediate Action Needed', color: 'bg-red-100 text-red-700' },
  today: { label: 'Action Needed Today', color: 'bg-amber-100 text-amber-700' },
  this_week: { label: 'Action This Week', color: 'bg-blue-100 text-blue-700' },
  before_next_milestone: { label: 'Before Next Milestone', color: 'bg-gray-100 text-gray-600' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function LeverageMomentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [moment, setMoment] = useState<LeverageMoment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchMoment() {
      try {
        const response = await fetch(`/api/leverage-moments/${id}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setMoment(data.moment);
      } catch (err) {
        setError('Unable to load leverage moment');
      } finally {
        setLoading(false);
      }
    }

    fetchMoment();
  }, [id]);

  const handleAction = async (action: 'acknowledge' | 'complete' | 'dismiss', outcome?: string) => {
    setActionLoading(true);

    try {
      const response = await fetch(`/api/leverage-moments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, outcome }),
      });

      if (!response.ok) throw new Error('Action failed');

      // Navigate back
      router.push('/pipeline');
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-60 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !moment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">{error || 'Moment not found'}</p>
          <Link href="/pipeline" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            Back to Pipeline
          </Link>
        </div>
      </div>
    );
  }

  const config = typeConfig[moment.type] || typeConfig.relationship_repair;
  const urgency = urgencyConfig[moment.urgency] || urgencyConfig.this_week;
  const Icon = config.icon;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Link */}
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipeline
      </Link>

      {/* Header */}
      <div className={cn('rounded-xl border p-6 mb-6', config.bgColor)}>
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-lg bg-white', config.color)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold text-gray-900">{config.label}</h1>
              <span className={cn('text-xs px-2 py-1 rounded', urgency.color)}>
                {urgency.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {moment.company && (
                <Link
                  href={`/companies/${moment.company.id}`}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  <Building2 className="h-4 w-4" />
                  {moment.company.name}
                </Link>
              )}
              {moment.deal && (
                <Link
                  href={`/deals/${moment.deal.id}`}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  <Target className="h-4 w-4" />
                  {moment.deal.name}
                </Link>
              )}
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {moment.confidence}% confidence
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Basis */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">
              {moment.trust_basis.accuracyLabel} based on {moment.trust_basis.sampleSize} similar situations
            </p>
            <p className="text-sm text-blue-700 mt-1">{moment.trust_basis.similarOutcomes}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Situation */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Situation</h2>
            <p className="text-gray-700">{moment.situation}</p>
          </section>

          {/* Why It Matters */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Why This Matters</h2>
            <p className="text-gray-700">{moment.why_it_matters}</p>
          </section>

          {/* What AI Did */}
          <section className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">What AI Already Tried</h2>
            <p className="text-gray-600">{moment.what_ai_did}</p>
          </section>

          {/* What You Should Do */}
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              What You Should Do
            </h2>
            <p className="text-amber-900 font-medium text-lg">{moment.what_human_must_do}</p>
            <p className="text-amber-700 mt-3 text-sm">{moment.why_human}</p>
          </section>

          {/* Talking Points */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Talking Points</h2>
            <ul className="space-y-3">
              {moment.talking_points.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* What to Avoid */}
          <section className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              What to Avoid
            </h2>
            <ul className="space-y-2">
              {moment.avoid.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-red-800">
                  <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Success Criteria & Fallback */}
          <div className="grid grid-cols-2 gap-4">
            <section className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h2 className="font-semibold text-green-900 mb-2 text-sm flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Success Looks Like
              </h2>
              <p className="text-green-800 text-sm">{moment.success_criteria}</p>
            </section>
            <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                If Unsuccessful
              </h2>
              <p className="text-gray-600 text-sm">{moment.if_unsuccessful}</p>
            </section>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Take Action</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleAction('complete', 'successful')}
                disabled={actionLoading}
                className="w-full h-10 px-4 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Mark Complete (Successful)
              </button>
              <button
                onClick={() => handleAction('complete', 'unsuccessful')}
                disabled={actionLoading}
                className="w-full h-10 px-4 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4" />
                Mark Complete (Unsuccessful)
              </button>
              <button
                onClick={() => handleAction('dismiss')}
                disabled={actionLoading}
                className="w-full h-10 px-4 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>
          </div>

          {/* Contact Info */}
          {moment.contact && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Contact</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{moment.contact.name}</p>
                    {moment.contact.title && (
                      <p className="text-sm text-gray-500">{moment.contact.title}</p>
                    )}
                  </div>
                </div>
                {moment.contact.email && (
                  <a
                    href={`mailto:${moment.contact.email}`}
                    className="text-sm text-blue-600 hover:text-blue-700 block"
                  >
                    {moment.contact.email}
                  </a>
                )}
                {moment.contact.phone && (
                  <a
                    href={`tel:${moment.contact.phone}`}
                    className="text-sm text-blue-600 hover:text-blue-700 block"
                  >
                    {moment.contact.phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Data Points */}
          {moment.trust_basis.dataPoints.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Key Data</h2>
              <div className="space-y-3">
                {moment.trust_basis.dataPoints.map((dp, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-500">{dp.label}</span>
                    <span className="font-medium text-gray-900">{dp.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deal Info */}
          {moment.deal && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Deal</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Value</span>
                  <span className="font-medium text-gray-900">
                    ${moment.deal.estimated_value.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Stage</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {moment.deal.stage.replace('_', ' ')}
                  </span>
                </div>
                {moment.deal.expected_close_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Close Date</span>
                    <span className="font-medium text-gray-900">
                      {new Date(moment.deal.expected_close_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <Link
                href={`/deals/${moment.deal.id}`}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View Deal
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
