import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Edit2,
  User,
  Activity,
  Clock,
  Mail,
  Phone,
  Pencil,
  Plus,
  Users,
  Crown,
  Star,
  UserCheck,
  UserX,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import {
  getHealthScoreColor,
  getHealthScoreLabel,
  PIPELINE_STAGES,
} from '@/types';

interface DealPageProps {
  params: Promise<{ id: string }>;
}

export default async function DealPage({ params }: DealPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(*),
      owner:users(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error || !deal) {
    notFound();
  }

  // Get activities for this deal
  const { data: activities } = await supabase
    .from('activities')
    .select('*, user:users(name)')
    .eq('deal_id', id)
    .order('occurred_at', { ascending: false })
    .limit(10);

  // Get tasks for this deal
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('deal_id', id)
    .is('completed_at', null)
    .order('due_at', { ascending: true })
    .limit(5);

  // Get contacts for this company
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', deal.company_id)
    .order('is_primary', { ascending: false })
    .order('name');

  const currentStage = PIPELINE_STAGES.find((s) => s.id === deal.stage);

  // Role display config
  const roleConfig: Record<string, { label: string; icon: any; color: string }> = {
    decision_maker: { label: 'Decision Maker', icon: Crown, color: 'text-amber-600 bg-amber-50' },
    champion: { label: 'Champion', icon: Star, color: 'text-green-600 bg-green-50' },
    influencer: { label: 'Influencer', icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
    end_user: { label: 'End User', icon: User, color: 'text-gray-600 bg-gray-50' },
    blocker: { label: 'Blocker', icon: UserX, color: 'text-red-600 bg-red-50' },
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pipeline
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{deal.name}</h1>
            {deal.company && (
              <Link
                href={`/organizations/${deal.company.id}`}
                className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 mt-1"
              >
                <Building2 className="h-4 w-4" />
                {deal.company.name}
              </Link>
            )}
          </div>

          <Link
            href={`/deals/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stage Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Stage Progress</h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {PIPELINE_STAGES.filter(
                (s) => s.id !== 'closed_won' && s.id !== 'closed_lost'
              ).map((stage, index) => {
                const isActive = stage.id === deal.stage;
                const isPast =
                  PIPELINE_STAGES.findIndex((s) => s.id === deal.stage) > index;

                return (
                  <div key={stage.id} className="flex items-center">
                    <div
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                        isActive && `${stage.color} text-white`,
                        isPast && 'bg-gray-200 text-gray-600',
                        !isActive && !isPast && 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {stage.name}
                    </div>
                    {index < 6 && (
                      <div
                        className={cn(
                          'w-4 h-0.5 mx-1',
                          isPast ? 'bg-gray-300' : 'bg-gray-200'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Contacts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Key Contacts</h2>
              <div className="flex items-center gap-2">
                <Link
                  href={`/contacts/new?organization_id=${deal.company_id}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Link>
                <span className="text-gray-300">|</span>
                <Link
                  href={`/organizations/${deal.company_id}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View All
                </Link>
              </div>
            </div>
            {contacts && contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((contact) => {
                  const role = contact.role ? roleConfig[contact.role] : null;
                  const RoleIcon = role?.icon || User;
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            {contact.is_primary && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{contact.title || 'No title'}</p>
                          {role && (
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1',
                              role.color
                            )}>
                              <RoleIcon className="h-3 w-3" />
                              {role.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={contact.email}
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={contact.phone}
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        <Link
                          href={`/contacts/${contact.id}/edit`}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit contact"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No contacts added yet</p>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {activities && activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{activity.user?.name}</span>
                        {' '}
                        {activity.type.replace('_', ' ')}
                        {activity.subject && `: ${activity.subject}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatRelativeTime(activity.occurred_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No activity yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Health Score */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Health Score</h2>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'text-4xl font-bold',
                  getHealthScoreColor(deal.health_score)
                )}
              >
                {deal.health_score}
              </div>
              <div>
                <p className={cn('font-medium', getHealthScoreColor(deal.health_score))}>
                  {getHealthScoreLabel(deal.health_score)}
                </p>
                <p className="text-xs text-gray-500">out of 100</p>
              </div>
            </div>
          </div>

          {/* Deal Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Deal Info</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Estimated Value</p>
                  <p className="font-medium">{formatCurrency(deal.estimated_value)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Owner</p>
                  <p className="font-medium">{deal.owner?.name || 'Unassigned'}</p>
                </div>
              </div>

              {deal.expected_close_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Expected Close</p>
                    <p className="font-medium">{formatDate(deal.expected_close_date)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">In Stage Since</p>
                  <p className="font-medium">{formatRelativeTime(deal.stage_entered_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Open Tasks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Open Tasks</h2>
            {tasks && tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        Due {formatRelativeTime(task.due_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No open tasks</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
