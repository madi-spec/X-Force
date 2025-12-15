'use client';

import { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';

interface AnalysisSummaryCardProps {
  summary: string;
  headline: string;
}

export function AnalysisSummaryCard({ summary, headline }: AnalysisSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Summary</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4">
        <p className="text-sm font-medium text-blue-700 mb-3 bg-blue-50 px-3 py-2 rounded-lg">
          {headline}
        </p>
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {summary}
        </div>
      </div>
    </div>
  );
}
