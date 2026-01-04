'use client';

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Collateral,
  DocumentType,
  MeetingType,
  ProductTag,
  IndustryTag,
  CompanySizeTag,
} from '@/types/collateral';
import {
  DOCUMENT_TYPE_LABELS,
  MEETING_TYPE_LABELS,
  PRODUCT_TAG_LABELS,
  INDUSTRY_TAG_LABELS,
  COMPANY_SIZE_LABELS,
} from '@/types/collateral';

interface CollateralUploadModalProps {
  collateral?: Collateral; // If provided, we're editing
  onClose: () => void;
  onSaved: (collateral: Collateral) => void;
}

export function CollateralUploadModal({
  collateral,
  onClose,
  onSaved,
}: CollateralUploadModalProps) {
  const isEditing = Boolean(collateral);

  // Form state
  const [name, setName] = useState(collateral?.name || '');
  const [description, setDescription] = useState(collateral?.description || '');
  const [documentType, setDocumentType] = useState<DocumentType>(
    collateral?.document_type || 'one_pager'
  );
  const [isLink, setIsLink] = useState(collateral?.file_type === 'link');
  const [externalUrl, setExternalUrl] = useState(collateral?.external_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>(
    collateral?.meeting_types || []
  );
  const [products, setProducts] = useState<ProductTag[]>(
    collateral?.products || []
  );
  const [industries, setIndustries] = useState<IndustryTag[]>(
    collateral?.industries || []
  );
  const [companySizes, setCompanySizes] = useState<CompanySizeTag[]>(
    collateral?.company_sizes || []
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    if (!name) {
      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setName(fileNameWithoutExt);
    }
    setError(null);
  }, [name]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const toggleArrayItem = <T extends string>(
    arr: T[],
    item: T,
    setter: (arr: T[]) => void
  ) => {
    if (arr.includes(item)) {
      setter(arr.filter((i) => i !== item));
    } else {
      setter([...arr, item]);
    }
  };

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    if (isLink && !externalUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!isLink && !isEditing && !file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      let filePath = collateral?.file_path;
      let fileName = collateral?.file_name;
      let fileType = isLink ? 'link' : collateral?.file_type;
      let fileSize = collateral?.file_size;

      // Upload file if new file selected
      if (!isLink && file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/collateral/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error || 'Failed to upload file');
        }

        const uploadData = await uploadRes.json();
        filePath = uploadData.file_path;
        fileName = uploadData.file_name;
        fileType = uploadData.file_type;
        fileSize = uploadData.file_size;
      }

      // Create or update collateral
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        document_type: documentType,
        file_type: isLink ? 'link' : fileType,
        file_path: isLink ? null : filePath,
        file_name: isLink ? null : fileName,
        file_size: isLink ? null : fileSize,
        external_url: isLink ? externalUrl.trim() : null,
        meeting_types: meetingTypes,
        products: products,
        industries: industries,
        company_sizes: companySizes,
      };

      const res = await fetch(
        isEditing ? `/api/collateral/${collateral!.id}` : '/api/collateral',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save collateral');
      }

      const data = await res.json();
      onSaved(data.collateral);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setUploading(false);
    }
  }, [
    name,
    description,
    documentType,
    isLink,
    externalUrl,
    file,
    meetingTypes,
    products,
    industries,
    companySizes,
    isEditing,
    collateral,
    onSaved,
  ]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {isEditing ? 'Edit Collateral' : 'Add New Collateral'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsLink(false)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                !isLink
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              <FileText className="h-5 w-5" />
              <span className="font-medium">Upload File</span>
            </button>
            <button
              onClick={() => setIsLink(true)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                isLink
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              <LinkIcon className="h-5 w-5" />
              <span className="font-medium">External Link</span>
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Voice Agent One-Pager"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this collateral..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type *
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-sm"
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* File or URL */}
          {isLink ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL *
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com/document"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File {!isEditing && '*'}
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  dragActive
                    ? 'border-gray-900 bg-gray-50'
                    : file
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileSelect(selectedFile);
                  }}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                ) : collateral?.file_name ? (
                  <div className="text-gray-600">
                    <p className="text-sm">Current file: {collateral.file_name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Drop a new file to replace
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, DOCX, PPTX, XLSX, HTML, PNG, JPG (max 25MB)
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Meeting Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Types
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    toggleArrayItem(meetingTypes, value as MeetingType, setMeetingTypes)
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-colors',
                    meetingTypes.includes(value as MeetingType)
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Products
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRODUCT_TAG_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    toggleArrayItem(products, value as ProductTag, setProducts)
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-colors',
                    products.includes(value as ProductTag)
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Industries */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Industries
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(INDUSTRY_TAG_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    toggleArrayItem(industries, value as IndustryTag, setIndustries)
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-colors',
                    industries.includes(value as IndustryTag)
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Company Sizes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Sizes
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    toggleArrayItem(companySizes, value as CompanySizeTag, setCompanySizes)
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-colors',
                    companySizes.includes(value as CompanySizeTag)
                      ? 'border-amber-600 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50 transition-colors"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Collateral'}
          </button>
        </div>
      </div>
    </div>
  );
}
