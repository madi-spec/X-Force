import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Building2, Target } from 'lucide-react';

export default async function ProspectingPage() {
  const supabase = await createClient();

  // Get prospecting pipeline entries (if table exists)
  // For now, we'll show an empty pipeline since the table may not exist yet
  const stages = ['lead', 'qualified', 'meeting_scheduled', 'proposal_sent', 'negotiating'];
  const stageLabels: Record<string, string> = {
    lead: 'New Lead',
    qualified: 'Qualified',
    meeting_scheduled: 'Meeting Set',
    proposal_sent: 'Proposal Sent',
    negotiating: 'Negotiating'
  };

  // Try to get prospects from company_products with in_sales status and no VFP
  const { data: prospects } = await supabase
    .from('company_products')
    .select(`
      id,
      status,
      mrr,
      created_at,
      company:companies(id, name, domain, industry),
      product:products(id, name, slug)
    `)
    .eq('status', 'in_sales')
    .order('created_at', { ascending: false })
    .limit(100);

  // Filter to non-VFP products (these are prospecting opportunities)
  const nonVfpProspects = (prospects || []).filter(p => {
    const product = Array.isArray(p.product) ? p.product[0] : p.product;
    return product && !['voice-for-pest', 'voice-for-turf'].includes(product.slug);
  });

  // Group by a simple stage assignment (all in 'lead' for now)
  const prospectsByStage = stages.map(stage => ({
    stage,
    label: stageLabels[stage],
    prospects: stage === 'lead' ? nonVfpProspects : []
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Prospecting Pipeline</h1>
          <p className="text-sm text-gray-500">New business opportunities</p>
        </div>
        <Link
          href="/companies/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Prospect
        </Link>
      </div>

      {/* Pipeline Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {prospectsByStage.map(({ stage, label, prospects }) => (
          <div key={stage} className="flex-shrink-0 w-72">
            <div className="bg-gray-100 rounded-t-xl px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{label}</span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {prospects.length}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-b-xl p-2 min-h-[400px] space-y-2">
              {prospects.map((prospect) => (
                <ProspectCard key={prospect.id} prospect={prospect} />
              ))}

              {prospects.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No prospects
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProspectCardProps {
  prospect: {
    id: string;
    status: string;
    mrr: number | null;
    created_at: string;
    company: { id: string; name: string; domain: string | null; industry: string | null } | { id: string; name: string; domain: string | null; industry: string | null }[] | null;
    product: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  };
}

function ProspectCard({ prospect }: ProspectCardProps) {
  const company = Array.isArray(prospect.company) ? prospect.company[0] : prospect.company;
  const product = Array.isArray(prospect.product) ? prospect.product[0] : prospect.product;

  if (!company) return null;

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2 mb-2">
        <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {company.name}
          </div>
          {company.industry && (
            <div className="text-xs text-gray-500">{company.industry}</div>
          )}
        </div>
      </div>

      {product && (
        <div className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded inline-block mb-2">
          {product.name}
        </div>
      )}

      {prospect.mrr && (
        <div className="text-sm text-green-600 font-medium">
          ${prospect.mrr.toLocaleString()}/mo
        </div>
      )}
    </Link>
  );
}
