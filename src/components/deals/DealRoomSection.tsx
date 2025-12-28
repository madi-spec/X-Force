'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Plus,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  GripVertical,
  Eye,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DealRoomAsset, DealRoomAssetType } from '@/types';
import { AssetUploadModal } from './AssetUploadModal';

interface DealRoomSectionProps {
  dealId: string;
}

interface DealRoomData {
  id: string;
  slug: string;
  assets?: DealRoomAsset[];
}

interface Analytics {
  totalViews: number;
  uniqueViewers: number;
  lastViewed: string | null;
  topViewers: { email: string; name: string | null; count: number }[];
}

const assetTypeIcons: Record<DealRoomAssetType, typeof FileText> = {
  document: FileText,
  video: Video,
  image: ImageIcon,
  link: LinkIcon,
};

const assetTypeColors: Record<DealRoomAssetType, string> = {
  document: 'bg-blue-100 text-blue-600',
  video: 'bg-purple-100 text-purple-600',
  image: 'bg-green-100 text-green-600',
  link: 'bg-amber-100 text-amber-600',
};

export function DealRoomSection({ dealId }: DealRoomSectionProps) {
  const router = useRouter();
  const [dealRoom, setDealRoom] = useState<DealRoomData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const fetchDealRoom = useCallback(async () => {
    try {
      const response = await fetch(`/api/deal-rooms/${dealId}`);
      if (response.ok) {
        const data = await response.json();
        setDealRoom(data.dealRoom);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching deal room:', error);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchDealRoom();
  }, [fetchDealRoom]);

  const handleCreateRoom = useCallback(async () => {
    setCreating(true);
    try {
      const response = await fetch(`/api/deal-rooms/${dealId}`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setDealRoom(data.dealRoom);
        setAnalytics({ totalViews: 0, uniqueViewers: 0, lastViewed: null, topViewers: [] });
      }
    } catch (error) {
      console.error('Error creating deal room:', error);
    } finally {
      setCreating(false);
    }
  }, [dealId]);

  const handleCopyLink = useCallback(async () => {
    if (!dealRoom) return;
    const url = `${window.location.origin}/room/${dealRoom.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [dealRoom]);

  const handleDeleteAsset = useCallback(async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    setDeletingAssetId(assetId);
    try {
      const response = await fetch(`/api/deal-rooms/${dealId}/assets/${assetId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDealRoom(prev =>
          prev
            ? { ...prev, assets: (prev.assets || []).filter(a => a.id !== assetId) }
            : null
        );
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
    } finally {
      setDeletingAssetId(null);
    }
  }, [dealId]);

  const handleAssetUploaded = useCallback((asset: DealRoomAsset) => {
    setDealRoom(prev =>
      prev
        ? { ...prev, assets: [...(prev.assets || []), asset] }
        : null
    );
    setShowUploadModal(false);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Deal Room</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // No room yet - show create button
  if (!dealRoom) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Deal Room</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Create a shareable deal room to share documents, videos, and links with your prospect.
        </p>
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Deal Room
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Deal Room</h2>
          {analytics && analytics.totalViews > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <Eye className="h-3 w-3" />
              {analytics.totalViews} view{analytics.totalViews !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <a
            href={`/room/${dealRoom.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Preview</span>
          </a>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Assets List */}
      <div className="p-4">
        {!dealRoom.assets || dealRoom.assets.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No assets yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Add documents, videos, or links to share with your prospect
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(dealRoom.assets || []).map((asset) => {
              const Icon = assetTypeIcons[asset.type];
              const colorClass = assetTypeColors[asset.type];

              return (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group"
                >
                  <GripVertical className="h-4 w-4 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={cn('p-2 rounded-lg', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {asset.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{asset.type}</p>
                  </div>
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    disabled={deletingAssetId === asset.id}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingAssetId === asset.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analytics Summary */}
      {analytics && analytics.uniqueViewers > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <span>
              <strong className="text-gray-700">{analytics.uniqueViewers}</strong> unique viewer{analytics.uniqueViewers !== 1 ? 's' : ''}
            </span>
            {analytics.lastViewed && (
              <span>
                Last viewed: {new Date(analytics.lastViewed).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <AssetUploadModal
          dealId={dealId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={handleAssetUploaded}
        />
      )}
    </div>
  );
}
