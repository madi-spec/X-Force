'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Users,
  Clock,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface Analytics {
  totalViews: number;
  uniqueViewers: number;
  lastViewed: string | null;
  topViewers: { email: string; name: string | null; count: number }[];
  assetViews?: { assetId: string; assetName: string; assetType: string; viewCount: number }[];
}

interface DealRoomAnalyticsProps {
  dealId: string;
}

const assetTypeIcons: Record<string, typeof FileText> = {
  document: FileText,
  video: Video,
  image: ImageIcon,
  link: LinkIcon,
};

export function DealRoomAnalytics({ dealId }: DealRoomAnalyticsProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasRoom, setHasRoom] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/deal-rooms/${dealId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.dealRoom) {
          setHasRoom(true);
          setAnalytics(data.analytics);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Room Analytics</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!hasRoom) {
    return null; // Don't show analytics if no room exists
  }

  if (!analytics || analytics.totalViews === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Room Analytics</h2>
        </div>
        <p className="text-sm text-gray-500">No views yet. Share the room link to start tracking engagement.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-indigo-600" />
        <h2 className="font-semibold text-gray-900">Room Analytics</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium">Total Views</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{analytics.totalViews}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Unique Viewers</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{analytics.uniqueViewers}</p>
        </div>
      </div>

      {/* Last Viewed */}
      {analytics.lastViewed && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Clock className="h-4 w-4" />
          <span>Last viewed {formatRelativeTime(analytics.lastViewed)}</span>
        </div>
      )}

      {/* Top Viewers */}
      {analytics.topViewers && analytics.topViewers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Top Viewers
          </h3>
          <div className="space-y-2">
            {analytics.topViewers.slice(0, 5).map((viewer, index) => (
              <div
                key={viewer.email}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium',
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-gray-200 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  )}>
                    {index + 1}
                  </div>
                  <span className="truncate text-gray-700">
                    {viewer.name || viewer.email}
                  </span>
                </div>
                <span className="text-gray-500 ml-2 shrink-0">
                  {viewer.count} view{viewer.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Asset Views */}
      {analytics.assetViews && analytics.assetViews.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Asset Engagement
          </h3>
          <div className="space-y-2">
            {analytics.assetViews.map((asset) => {
              const Icon = assetTypeIcons[asset.assetType] || FileText;
              return (
                <div
                  key={asset.assetId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate text-gray-700">{asset.assetName}</span>
                  </div>
                  <span className="text-gray-500 ml-2 shrink-0">
                    {asset.viewCount} view{asset.viewCount !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
