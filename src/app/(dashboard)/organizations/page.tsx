import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const segmentLabels: Record<string, string> = {
  smb: 'SMB',
  mid_market: 'Mid-Market',
  enterprise: 'Enterprise',
  pe_platform: 'PE Platform',
  franchisor: 'Franchisor',
};

const statusColors: Record<string, string> = {
  cold_lead: 'bg-gray-100 text-gray-700',
  prospect: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  churned: 'bg-red-100 text-red-700',
};

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 text-sm mt-1">
            {companies?.length || 0} companies
          </p>
        </div>
        <Link
          href="/organizations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Company
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies?.map((company) => (
          <Link
            key={company.id}
            href={`/organizations/${company.id}`}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{company.name}</h3>
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                  statusColors[company.status] || 'bg-gray-100 text-gray-700'
                )}
              >
                {company.status?.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{company.agent_count} agents</span>
                <span className="text-gray-300">|</span>
                <span>{segmentLabels[company.segment] || company.segment}</span>
              </div>

              {company.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {company.address.city}, {company.address.state}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="capitalize">{company.industry}</span>
                {company.crm_platform && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="capitalize">{company.crm_platform}</span>
                  </>
                )}
              </div>
            </div>

            {company.voice_customer && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs font-medium text-green-600">
                  Voice Customer
                </span>
              </div>
            )}
          </Link>
        ))}

        {(!companies || companies.length === 0) && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No companies yet. Add your first company to get started.
          </div>
        )}
      </div>
    </div>
  );
}
