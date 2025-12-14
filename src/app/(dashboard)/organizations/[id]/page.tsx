import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/types';

interface OrganizationPageProps {
  params: Promise<{ id: string }>;
}

const segmentLabels: Record<string, string> = {
  smb: 'SMB',
  mid_market: 'Mid-Market',
  enterprise: 'Enterprise',
  pe_platform: 'PE Platform',
  franchisor: 'Franchisor',
};

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !company) {
    notFound();
  }

  // Get contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', id)
    .order('is_primary', { ascending: false });

  // Get deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*, owner:users(name)')
    .eq('company_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-gray-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {company.name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="capitalize">{company.status?.replace('_', ' ')}</span>
                <span>|</span>
                <span>{segmentLabels[company.segment]}</span>
                <span>|</span>
                <span>{company.agent_count} agents</span>
              </div>
            </div>
          </div>

          <Link
            href={`/organizations/${id}/edit`}
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
          {/* Contacts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Contacts</h2>
              <Link
                href={`/contacts/new?organization_id=${id}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </Link>
            </div>

            {contacts && contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((contact) => (
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
                        <p className="text-sm text-gray-500">
                          {contact.title || contact.role || 'No title'}
                        </p>
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
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit contact"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No contacts yet</p>
            )}
          </div>

          {/* Deals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Deals</h2>
              <Link
                href={`/deals/new?organization=${id}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Deal
              </Link>
            </div>

            {deals && deals.length > 0 ? (
              <div className="space-y-3">
                {deals.map((deal) => {
                  const stage = PIPELINE_STAGES.find((s) => s.id === deal.stage);
                  return (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{deal.name}</p>
                          <p className="text-sm text-gray-500">
                            {deal.owner?.name} | {formatCurrency(deal.estimated_value)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-medium px-2.5 py-0.5 rounded-full text-white',
                            stage?.color || 'bg-gray-500'
                          )}
                        >
                          {stage?.name || deal.stage}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No deals yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-500">Industry</p>
                <p className="font-medium text-gray-900 capitalize">
                  {company.industry}
                </p>
              </div>

              <div>
                <p className="text-gray-500">CRM Platform</p>
                <p className="font-medium text-gray-900 capitalize">
                  {company.crm_platform || 'Unknown'}
                </p>
              </div>

              {company.address && (
                <div>
                  <p className="text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">
                    {company.address.street}
                    <br />
                    {company.address.city}, {company.address.state}{' '}
                    {company.address.zip}
                  </p>
                </div>
              )}

              {company.voice_customer && (
                <div>
                  <p className="text-gray-500">Voice Customer</p>
                  <p className="font-medium text-green-600">
                    Yes
                    {company.voice_customer_since &&
                      ` - Since ${formatDate(company.voice_customer_since)}`}
                  </p>
                </div>
              )}

              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium text-gray-900">
                  {formatDate(company.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
