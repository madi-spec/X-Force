'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FolderOpen, Loader2, Eye, Link2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Collateral, CollateralFilters as Filters } from '@/types/collateral';
import { CollateralCard } from './CollateralCard';
import { CollateralFilters } from './CollateralFilters';
import { CollateralUploadModal } from './CollateralUploadModal';

interface AnalyticsTotals {
  collateral: number;
  views: number;
  copies: number;
}

export function CollateralLibrary() {
  const [collateral, setCollateral] = useState<Collateral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingCollateral, setEditingCollateral] = useState<Collateral | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsTotals | null>(null);

  // Fetch collateral
  const fetchCollateral = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.document_type) params.set('document_type', filters.document_type);
      if (filters.meeting_type) params.set('meeting_type', filters.meeting_type);
      if (filters.product) params.set('product', filters.product);
      if (filters.industry) params.set('industry', filters.industry);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/collateral?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch collateral');

      const data = await res.json();
      setCollateral(data.collateral || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collateral');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCollateral();
  }, [fetchCollateral]);

  // Fetch analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/collateral/analytics');
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data.totals);
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      }
    };
    fetchAnalytics();
  }, []);

  // Show toast
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle view/download
  const handleView = async (id: string) => {
    const item = collateral.find((c) => c.id === id);
    if (!item) return;

    // Track usage
    await fetch(`/api/collateral/${id}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'viewed' }),
    });

    // Open URL
    if (item.file_type === 'link' && item.external_url) {
      window.open(item.external_url, '_blank');
    } else {
      // Get signed URL and open
      const res = await fetch(`/api/collateral/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.collateral.file_url) {
          window.open(data.collateral.file_url, '_blank');
        }
      }
    }
  };

  // Handle copy link
  const handleCopyLink = async (item: Collateral) => {
    const url = item.file_type === 'link'
      ? item.external_url
      : `${window.location.origin}/api/collateral/${item.id}`;

    if (url) {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard', 'success');

      // Track usage
      await fetch(`/api/collateral/${item.id}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copied_link' }),
      });
    }
  };

  // Handle edit
  const handleEdit = (item: Collateral) => {
    setEditingCollateral(item);
    setShowUploadModal(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/collateral/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      setCollateral((prev) => prev.filter((c) => c.id !== id));
      showToast('Collateral deleted', 'success');
    } catch {
      showToast('Failed to delete collateral', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Handle save (from modal)
  const handleSaved = (saved: Collateral) => {
    if (editingCollateral) {
      // Update existing
      setCollateral((prev) =>
        prev.map((c) => (c.id === saved.id ? saved : c))
      );
      showToast('Collateral updated', 'success');
    } else {
      // Add new
      setCollateral((prev) => [saved, ...prev]);
      showToast('Collateral added', 'success');
    }
    setShowUploadModal(false);
    setEditingCollateral(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-normal text-gray-900">Collateral Library</h1>
            <p className="text-xs text-gray-500">
              Sales materials, case studies, and resources
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCollateral(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Collateral
          </button>
        </div>

        {/* Analytics Summary */}
        {analytics && (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Stats:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900">{analytics.collateral}</span>
              <span className="text-xs text-gray-500">items</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm font-medium text-gray-900">{analytics.views}</span>
              <span className="text-xs text-gray-500">views</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-medium text-gray-900">{analytics.copies}</span>
              <span className="text-xs text-gray-500">link copies</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <CollateralFilters
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters({})}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded mt-2" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchCollateral}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Try again
            </button>
          </div>
        ) : collateral.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-gray-900 font-medium mb-1">No collateral found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {Object.keys(filters).length > 0
                ? 'Try adjusting your filters'
                : 'Add your first piece of sales collateral'}
            </p>
            {Object.keys(filters).length === 0 && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Collateral
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {collateral.map((item) => (
              <CollateralCard
                key={item.id}
                collateral={item}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteConfirm(id)}
                onCopyLink={handleCopyLink}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload/Edit Modal */}
      {showUploadModal && (
        <CollateralUploadModal
          collateral={editingCollateral || undefined}
          onClose={() => {
            setShowUploadModal(false);
            setEditingCollateral(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Collateral?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action will archive the collateral. It can be restored later.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50',
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
