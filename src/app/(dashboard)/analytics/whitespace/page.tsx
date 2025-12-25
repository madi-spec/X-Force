import { analyzeWhitespace, getWhitespaceOpportunities } from '@/lib/analytics/whitespaceAnalyzer';
import { WhitespaceStats } from '@/components/analytics/WhitespaceStats';
import { WhitespaceOpportunityList } from '@/components/analytics/WhitespaceOpportunityList';
import { ProductAdoptionChart } from '@/components/analytics/ProductAdoptionChart';

export default async function WhitespacePage() {
  const stats = await analyzeWhitespace();
  const opportunities = await getWhitespaceOpportunities({ limit: 20 });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-normal text-gray-900">Whitespace Analysis</h1>
        <p className="text-sm text-gray-500">
          Find expansion opportunities in your existing customer base
        </p>
      </div>

      {/* Stats Cards */}
      <WhitespaceStats stats={stats} />

      {/* Adoption by Product Chart */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Product Adoption Opportunities
        </h2>
        <ProductAdoptionChart data={stats.opportunities_by_product} />
      </div>

      {/* Top Opportunities */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Top Expansion Opportunities
        </h2>
        <WhitespaceOpportunityList opportunities={opportunities} />
      </div>
    </div>
  );
}
