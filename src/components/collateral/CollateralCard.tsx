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
  MoreVertical,
  Eye,
  Download,
  Link2,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Collateral, DocumentType } from '@/types/collateral';
import { DOCUMENT_TYPE_LABELS, MEETING_TYPE_LABELS, PRODUCT_TAG_LABELS } from '@/types/collateral';

interface CollateralCardProps {
  collateral: Collateral;
  onView: (id: string) => void;
  onEdit: (collateral: Collateral) => void;
  onDelete: (id: string) => void;
  onCopyLink: (collateral: Collateral) => void;
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

export function CollateralCard({
  collateral,
  onView,
  onEdit,
  onDelete,
  onCopyLink,
}: CollateralCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const Icon = documentTypeIcons[collateral.document_type] || FileText;
  const isLink = collateral.file_type === 'link';

  const handleView = () => {
    onView(collateral.id);
    setMenuOpen(false);
  };

  const handleCopyLink = () => {
    onCopyLink(collateral);
    setMenuOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm line-clamp-1">
              {collateral.name}
            </h3>
            <p className="text-xs text-gray-500">
              {DOCUMENT_TYPE_LABELS[collateral.document_type]}
            </p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 w-40">
                <button
                  onClick={handleView}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {isLink ? <ExternalLink className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {isLink ? 'Open Link' : 'View'}
                </button>
                {!isLink && (
                  <button
                    onClick={handleView}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Link2 className="h-4 w-4" />
                  Copy Link
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => {
                    onEdit(collateral);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete(collateral.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {collateral.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {collateral.description}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {collateral.meeting_types.slice(0, 2).map((type) => (
          <span
            key={type}
            className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700"
          >
            {MEETING_TYPE_LABELS[type]}
          </span>
        ))}
        {collateral.products.slice(0, 1).map((product) => (
          <span
            key={product}
            className="px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-700"
          >
            {PRODUCT_TAG_LABELS[product]}
          </span>
        ))}
        {(collateral.meeting_types.length > 2 || collateral.products.length > 1) && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            +{collateral.meeting_types.length - 2 + collateral.products.length - 1} more
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {collateral.view_count}
          </span>
          {isLink && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Link
            </span>
          )}
        </div>
        <span>v{collateral.version}</span>
      </div>
    </div>
  );
}
