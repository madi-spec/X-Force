'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyResearchTabProps {
  companyId: string;
  companyName: string;
}

interface ResearchData {
  id: string;
  version: string;
  status: string;
  researched_at: string;
  duration_seconds: number;
  tool_calls: number;
  phases_completed: string[];
  confidence_score: number;
  confidence_breakdown: {
    identity: number;
    ownership: number;
    size: number;
    reputation: number;
    industry: number;
    enrichment: number;
    penalties: number;
  };
  key_findings: string[];
  summary: string;
  canonical_identity: {
    operating_name: string;
    ownership_type: string;
    family_generation?: string;
    pe_firm?: string;
  };
  tech_stack: Array<{
    vendor: string;
    category: string;
    confidence: string;
    is_known_vendor: boolean;
  }>;
  growth_signals: Array<{
    signal: string;
    value: unknown;
    interpretation: string;
  }>;
  timeline: Array<{
    year: number;
    event: string;
    source: string;
  }>;
  gaps: Array<{
    field: string;
    reason: string;
  }>;
}

interface ResearchResponse {
  success: boolean;
  research: ResearchData;
  markdown_report: string;
  is_stale: boolean;
  days_old: number;
}

export function CompanyResearchTab({ companyId, companyName }: CompanyResearchTabProps) {
  const router = useRouter();
  const [research, setResearch] = useState<ResearchData | null>(null);
  const [markdownReport, setMarkdownReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [daysOld, setDaysOld] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [extractionResult, setExtractionResult] = useState<string | null>(null);

  // Domain state
  const [domain, setDomain] = useState<string>('');
  const [suggestedDomain, setSuggestedDomain] = useState<string | null>(null);
  const [savedDomain, setSavedDomain] = useState<string | null>(null);

  // Fetch domain info from company and contacts
  const fetchDomainInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/intelligence/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.companyDomain) {
          setDomain(data.companyDomain);
          setSavedDomain(data.companyDomain);
        } else if (data.suggestedDomain) {
          setDomain(data.suggestedDomain);
          setSuggestedDomain(data.suggestedDomain);
        }
      }
    } catch (err) {
      console.error('Error fetching domain info:', err);
    }
  }, [companyId]);

  const fetchResearch = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/intelligence-v61/${companyId}/research`);

      if (response.status === 404) {
        setResearch(null);
        setMarkdownReport('');
        setError(null);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch research');
      }

      const data: ResearchResponse = await response.json();
      setResearch(data.research);
      setMarkdownReport(data.markdown_report);
      setIsStale(data.is_stale);
      setDaysOld(data.days_old);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load research');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchResearch();
    fetchDomainInfo();
  }, [fetchResearch, fetchDomainInfo]);

  const saveDomain = async (newDomain: string) => {
    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      if (!response.ok) {
        throw new Error('Failed to save domain');
      }
      setSavedDomain(newDomain);
    } catch (err) {
      console.error('Error saving domain:', err);
      setError(err instanceof Error ? err.message : 'Failed to save domain');
    }
  };

  const handleRunResearch = async () => {
    if (!domain) {
      setError('Please enter a domain before running research');
      return;
    }

    setResearching(true);
    setError(null);

    try {
      if (domain !== savedDomain) {
        await saveDomain(domain);
      }

      const response = await fetch(`/api/intelligence-v61/${companyId}/research`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Research failed');
      }

      await fetchResearch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setResearching(false);
    }
  };

  const handleCopyReport = async () => {
    await navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    const blob = new Blob([markdownReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.toLowerCase().replace(/\s+/g, '-')}-research.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExtractData = async () => {
    setExtracting(true);
    setError(null);
    setExtractionResult(null);

    try {
      const response = await fetch(`/api/intelligence-v61/${companyId}/extract`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Extraction failed');
      }

      const data = await response.json();
      // Show success message
      setExtractionResult(data.message || 'Data extracted successfully!');
      // Refresh the page to show updated contacts and company data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateStrategy = async () => {
    setGeneratingStrategy(true);
    setError(null);

    try {
      const response = await fetch(`/api/intelligence-v61/${companyId}/strategy`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Strategy generation failed');
      }

      const data = await response.json();
      // Show success message
      alert(`Sales strategy generated successfully! ${data.message || ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strategy generation failed');
    } finally {
      setGeneratingStrategy(false);
    }
  };

  if (loading) {
    return <ResearchSkeleton />;
  }

  // No research yet - show prompt to run
  if (!research) {
    const hasSuggestedDomain = suggestedDomain && !savedDomain;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Research Yet
        </h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Run AI-powered research to generate a comprehensive intelligence report for {companyName}.
          This will gather data from multiple sources including BBB, LinkedIn, PCT Magazine, and more.
        </p>

        {/* Domain Input */}
        <div className="max-w-md mx-auto mb-6">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 text-left">
            Company Website Domain
            {hasSuggestedDomain && (
              <span className="ml-2 text-green-600 normal-case font-normal">
                (detected from contact emails)
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  hasSuggestedDomain ? "border-green-300" : "border-gray-200"
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && domain) {
                    saveDomain(domain);
                  }
                }}
              />
            </div>
            {domain && domain !== savedDomain && (
              <button
                onClick={() => saveDomain(domain)}
                className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Save
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-left">
            {hasSuggestedDomain
              ? "This domain was detected from contact email addresses. Edit if needed."
              : savedDomain
              ? "Domain saved to company record."
              : "Enter the company's website domain to enable research."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm max-w-md mx-auto">
            {error}
          </div>
        )}

        <button
          onClick={handleRunResearch}
          disabled={researching || !domain}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {researching ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              Researching... (this takes 3-5 minutes)
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Run Research
            </>
          )}
        </button>

        {!domain && (
          <p className="text-xs text-amber-600 mt-2">
            Enter a domain to enable research
          </p>
        )}

        <p className="text-xs text-gray-400 mt-4">
          v6.1 Agent - Uses 45 tool calls max, 4-phase protocol
        </p>
      </div>
    );
  }

  // Research exists - show the report
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center',
              research.confidence_score >= 80 ? 'bg-green-100' :
              research.confidence_score >= 60 ? 'bg-amber-100' :
              'bg-red-100'
            )}>
              <FileText className={cn(
                'h-5 w-5',
                research.confidence_score >= 80 ? 'text-green-600' :
                research.confidence_score >= 60 ? 'text-amber-600' :
                'text-red-600'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">
                  Company Research
                </h2>
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  research.confidence_score >= 80 ? 'bg-green-100 text-green-700' :
                  research.confidence_score >= 60 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                )}>
                  {research.confidence_score}% confidence
                </span>
                {isStale && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Stale ({daysOld} days old)
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                {savedDomain && (
                  <>
                    <a
                      href={`https://${savedDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      {savedDomain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span>•</span>
                  </>
                )}
                v{research.version} • {new Date(research.researched_at).toLocaleDateString()} •{' '}
                {research.duration_seconds}s • {research.tool_calls} tool calls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {showMetadata ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Details
            </button>
            <button
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={handleRunResearch}
              disabled={researching}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {researching ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Re-run
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metadata Panel */}
        {showMetadata && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-4 gap-4">
              {/* Confidence Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Confidence Breakdown
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Identity</span>
                    <span className="font-medium text-gray-900">{research.confidence_breakdown.identity}/20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ownership</span>
                    <span className="font-medium text-gray-900">{research.confidence_breakdown.ownership}/20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size</span>
                    <span className="font-medium text-gray-900">{research.confidence_breakdown.size}/15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reputation</span>
                    <span className="font-medium text-gray-900">{research.confidence_breakdown.reputation}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Industry</span>
                    <span className="font-medium text-gray-900">{research.confidence_breakdown.industry}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Enrichment</span>
                    <span className="font-medium text-gray-900">{research.confidence_breakdown.enrichment}/10</span>
                  </div>
                  {research.confidence_breakdown.penalties < 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Penalties</span>
                      <span className="font-medium">{research.confidence_breakdown.penalties}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Phases */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Phases Completed
                </h4>
                <div className="flex flex-wrap gap-1">
                  {['identify', 'ground', 'enrich', 'validate'].map((phase) => (
                    <span
                      key={phase}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full capitalize',
                        research.phases_completed.includes(phase)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {phase}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tech Stack */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Technology
                </h4>
                <div className="space-y-1">
                  {research.tech_stack.length > 0 ? (
                    research.tech_stack.map((tech, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          tech.is_known_vendor ? 'bg-green-500' : 'bg-amber-500'
                        )} />
                        <span className="text-gray-900">{tech.vendor}</span>
                        <span className="text-xs text-gray-400">({tech.category})</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">None detected</p>
                  )}
                </div>
              </div>

              {/* Data Gaps */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Data Gaps
                </h4>
                <div className="space-y-1">
                  {research.gaps.length > 0 ? (
                    research.gaps.slice(0, 4).map((gap, i) => (
                      <div key={i} className="text-sm text-gray-500">
                        {gap.field}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-green-600">No major gaps</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Research Report - Rendered Markdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings
              h1: ({ children }) => (
                <h1 className="text-2xl font-semibold text-gray-900 mb-4 mt-6 first:mt-0 pb-2 border-b border-gray-200">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-6 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4 first:mt-0">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-base font-medium text-gray-800 mb-2 mt-3 first:mt-0">
                  {children}
                </h4>
              ),
              // Paragraphs
              p: ({ children }) => (
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                  {children}
                </p>
              ),
              // Lists
              ul: ({ children }) => (
                <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-sm text-gray-700 leading-relaxed">
                  {children}
                </li>
              ),
              // Emphasis
              strong: ({ children }) => (
                <strong className="font-semibold text-gray-900">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic text-gray-700">
                  {children}
                </em>
              ),
              // Links
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  {children}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ),
              // Code
              code: ({ children, className }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                    {children}
                  </code>
                ) : (
                  <code className="block p-3 text-xs font-mono bg-gray-50 text-gray-800 rounded-lg overflow-x-auto">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="mb-4 overflow-x-auto">
                  {children}
                </pre>
              ),
              // Blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-blue-50 rounded-r-lg">
                  {children}
                </blockquote>
              ),
              // Horizontal rule
              hr: () => (
                <hr className="my-6 border-gray-200" />
              ),
              // Tables
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-gray-50">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-gray-200 bg-white">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-gray-50 transition-colors">
                  {children}
                </tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-gray-700">
                  {children}
                </td>
              ),
            }}
          >
            {markdownReport}
          </ReactMarkdown>
        </div>
      </div>

      {/* Extraction Result */}
      {extractionResult && (
        <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
          <Check className="h-5 w-5" />
          {extractionResult}
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Next Steps
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Extract structured data and generate sales strategy from this research.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtractData}
              disabled={extracting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {extracting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  Extract Data
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              onClick={handleGenerateStrategy}
              disabled={generatingStrategy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generatingStrategy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Strategy
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div>
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-60 bg-gray-100 rounded mt-1" />
            </div>
          </div>
          <div className="h-9 w-24 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-4 w-4/6 bg-gray-100 rounded" />
          <div className="h-20 w-full bg-gray-50 rounded mt-4" />
        </div>
      </div>
    </div>
  );
}

export default CompanyResearchTab;
