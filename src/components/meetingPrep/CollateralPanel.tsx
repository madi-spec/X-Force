'use client';

import { useState } from 'react';
import {
  FileText,
  Video,
  Presentation,
  Calculator,
  FileCheck,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import type { ScoredCollateral } from '@/lib/collateral/matching';
import type { DocumentType } from '@/types/collateral';

interface CollateralPanelProps {
  collateral: ScoredCollateral[];
  onTrackUsage?: (collateralId: string, action: 'viewed' | 'copied_link') => void;
}

const documentTypeIcons: Record<DocumentType, typeof FileText> = {
  one_pager: FileText,
  case_study: BookOpen,
  pricing: Calculator,
  proposal_template: FileCheck,
  implementation_guide: BookOpen,
  technical_doc: FileText,
  demo_script: Presentation,
  roi_calculator: Calculator,
  contract: FileCheck,
  presentation: Presentation,
  video: Video,
  other: FileText,
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  one_pager: 'One-Pager',
  case_study: 'Case Study',
  pricing: 'Pricing',
  proposal_template: 'Proposal',
  implementation_guide: 'Implementation',
  technical_doc: 'Technical',
  demo_script: 'Demo Script',
  roi_calculator: 'ROI Calculator',
  contract: 'Contract',
  presentation: 'Presentation',
  video: 'Video',
  other: 'Other',
};

export function CollateralPanel({ collateral, onTrackUsage }: CollateralPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (item: ScoredCollateral) => {
    const url = item.file_type === 'link'
      ? item.external_url
      : `${window.location.origin}/api/collateral/${item.id}`;

    if (url) {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
      onTrackUsage?.(item.id, 'copied_link');
    }
  };

  const handleView = (item: ScoredCollateral) => {
    onTrackUsage?.(item.id, 'viewed');
    if (item.file_type === 'link' && item.external_url) {
      window.open(item.external_url, '_blank');
    } else {
      window.open(`/api/collateral/${item.id}`, '_blank');
    }
  };

  if (collateral.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Suggested Collateral
        </h2>
        <p className="text-sm text-gray-400">No matching collateral found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
        Suggested Collateral ({collateral.length})
      </h2>

      <div className="space-y-3">
        {collateral.map((item) => {
          const Icon = documentTypeIcons[item.document_type] || FileText;
          const isCopied = copiedId === item.id;

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 p-2 rounded-lg bg-white border border-gray-200">
                  <Icon className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {DOCUMENT_TYPE_LABELS[item.document_type]}
                    {item.relevanceScore >= 0.8 && (
                      <span className="ml-2 text-green-600">High match</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopyLink(item)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
                  title="Copy link"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleView(item)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
                  title={item.file_type === 'link' ? 'Open link' : 'View'}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
