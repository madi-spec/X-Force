'use client';

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DealRoomAsset, DealRoomAssetType } from '@/types';

interface AssetUploadModalProps {
  dealId: string;
  onClose: () => void;
  onUploaded: (asset: DealRoomAsset) => void;
}

const assetTypes: { type: DealRoomAssetType; label: string; icon: typeof FileText; accept?: string }[] = [
  { type: 'document', label: 'Document', icon: FileText, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' },
  { type: 'video', label: 'Video', icon: Video, accept: '.mp4,.mov,.avi,.webm' },
  { type: 'image', label: 'Image', icon: ImageIcon, accept: '.jpg,.jpeg,.png,.gif,.webp,.svg' },
  { type: 'link', label: 'External Link', icon: LinkIcon },
];

export function AssetUploadModal({ dealId, onClose, onUploaded }: AssetUploadModalProps) {
  const [assetType, setAssetType] = useState<DealRoomAssetType>('document');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedType = assetTypes.find(t => t.type === assetType)!;
  const isLinkType = assetType === 'link';

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    // Auto-fill name from filename
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!name.trim()) {
      setError('Please enter a name for this asset');
      return;
    }

    if (isLinkType) {
      if (!url.trim()) {
        setError('Please enter a URL');
        return;
      }
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    } else {
      if (!file) {
        setError('Please select a file to upload');
        return;
      }
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('type', assetType);
      formData.append('stageVisible', JSON.stringify([])); // All stages visible by default

      if (isLinkType) {
        formData.append('url', url.trim());
      } else if (file) {
        formData.append('file', file);
      }

      const response = await fetch(`/api/deal-rooms/${dealId}/assets`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload asset');
      }

      const data = await response.json();
      onUploaded(data.asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload asset');
    } finally {
      setUploading(false);
    }
  }, [dealId, name, assetType, url, file, isLinkType, onUploaded]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Add Asset to Deal Room</h3>
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

          {/* Asset Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asset Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {assetTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = assetType === type.type;
                return (
                  <button
                    key={type.type}
                    onClick={() => {
                      setAssetType(type.type);
                      setFile(null);
                      setUrl('');
                      setError(null);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Overview, Demo Video"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Link URL Input (for link type) */}
          {isLinkType ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/resource"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
          ) : (
            /* File Upload Area */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  dragActive
                    ? 'border-indigo-500 bg-indigo-50'
                    : file
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={selectedType.accept}
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileSelect(selectedFile);
                  }}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <selectedType.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedType.accept?.split(',').join(', ')}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading...' : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
