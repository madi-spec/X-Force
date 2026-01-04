'use client';

import { useState, useEffect } from 'react';
import {
  Link2,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Loader2,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingType } from '@/types/collateral';

interface SoftwareLink {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  show_for_meeting_types: string[] | null;
  show_for_products: string[] | null;
  show_for_deal_stages: string[] | null;
  is_active: boolean;
  sort_order: number;
}

const MEETING_TYPES: { id: MeetingType; label: string }[] = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'demo', label: 'Demo' },
  { id: 'technical_deep_dive', label: 'Technical Deep Dive' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'trial_kickoff', label: 'Trial Kickoff' },
  { id: 'implementation', label: 'Implementation' },
  { id: 'check_in', label: 'Check-in' },
  { id: 'executive', label: 'Executive' },
];

const ICON_OPTIONS = [
  'Link2',
  'ExternalLink',
  'Globe',
  'Monitor',
  'Video',
  'FileText',
  'Users',
  'Settings',
  'Database',
  'Code',
];

export function SoftwareLinksManager() {
  const [links, setLinks] = useState<SoftwareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLink, setEditingLink] = useState<SoftwareLink | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formMeetingTypes, setFormMeetingTypes] = useState<string[]>([]);

  // Fetch links on mount
  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/settings/software-links');
      const data = await res.json();
      if (res.ok) {
        setLinks(data.links || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Failed to fetch links:', err);
      setError('Failed to load software links');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingLink(null);
    setFormName('');
    setFormDescription('');
    setFormUrl('');
    setFormIcon('');
    setFormMeetingTypes([]);
    setIsModalOpen(true);
  };

  const openEditModal = (link: SoftwareLink) => {
    setEditingLink(link);
    setFormName(link.name);
    setFormDescription(link.description || '');
    setFormUrl(link.url);
    setFormIcon(link.icon || '');
    setFormMeetingTypes(link.show_for_meeting_types || []);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLink(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: formName,
        description: formDescription || null,
        url: formUrl,
        icon: formIcon || null,
        show_for_meeting_types: formMeetingTypes.length > 0 ? formMeetingTypes : [],
      };

      let res: Response;
      if (editingLink) {
        res = await fetch(`/api/settings/software-links/${editingLink.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/settings/software-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok) {
        await fetchLinks();
        closeModal();
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Failed to save:', err);
      setError('Failed to save software link');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (link: SoftwareLink) => {
    try {
      const res = await fetch(`/api/settings/software-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !link.is_active }),
      });

      if (res.ok) {
        setLinks((prev) =>
          prev.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l))
        );
      }
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const handleDelete = async (link: SoftwareLink) => {
    if (!confirm(`Delete "${link.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/settings/software-links/${link.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== link.id));
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const link = links[index];
    const prevLink = links[index - 1];

    // Swap sort_order
    await Promise.all([
      fetch(`/api/settings/software-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: prevLink.sort_order }),
      }),
      fetch(`/api/settings/software-links/${prevLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: link.sort_order }),
      }),
    ]);

    await fetchLinks();
  };

  const handleMoveDown = async (index: number) => {
    if (index === links.length - 1) return;
    const link = links[index];
    const nextLink = links[index + 1];

    // Swap sort_order
    await Promise.all([
      fetch(`/api/settings/software-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: nextLink.sort_order }),
      }),
      fetch(`/api/settings/software-links/${nextLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: link.sort_order }),
      }),
    ]);

    await fetchLinks();
  };

  const toggleMeetingType = (typeId: string) => {
    setFormMeetingTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        {/* List skeleton */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 animate-pulse"
            >
              <div className="flex flex-col gap-1">
                <div className="h-5 w-5 bg-gray-200 rounded" />
                <div className="h-5 w-5 bg-gray-200 rounded" />
              </div>
              <div className="h-10 w-10 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-3 w-64 bg-gray-200 rounded mt-2" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                <div className="h-8 w-8 bg-gray-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {links.length} link{links.length !== 1 ? 's' : ''} configured
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Link
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Links List */}
      {links.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Link2 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No software links configured</p>
          <button
            onClick={openCreateModal}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Add your first link
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link, index) => (
            <div
              key={link.id}
              className={cn(
                'flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 transition-opacity',
                !link.is_active && 'opacity-50'
              )}
            >
              {/* Drag Handle / Order Buttons */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <GripVertical className="h-4 w-4 text-gray-300" />
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === links.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* Link Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">{link.name}</h3>
                  {!link.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{link.url}</p>
                {link.description && (
                  <p className="text-xs text-gray-400 mt-1">{link.description}</p>
                )}
                {link.show_for_meeting_types && link.show_for_meeting_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {link.show_for_meeting_types.map((type) => (
                      <span
                        key={type}
                        className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700"
                      >
                        {MEETING_TYPES.find((t) => t.id === type)?.label || type}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  aria-label="Open link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => openEditModal(link)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(link)}
                  className={cn(
                    'p-2 rounded transition-colors',
                    link.is_active
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-50'
                  )}
                  aria-label={link.is_active ? 'Deactivate' : 'Activate'}
                >
                  {link.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleDelete(link)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg sm:mx-4 max-h-[100vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {editingLink ? 'Edit Link' : 'Add New Link'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="e.g., Demo Environment"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    required
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icon
                  </label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="">Default</option>
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Show for Meeting Types
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Leave all unchecked to show for all meeting types
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MEETING_TYPES.map((type) => (
                      <label
                        key={type.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                          formMeetingTypes.includes(type.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={formMeetingTypes.includes(type.id)}
                          onChange={() => toggleMeetingType(type.id)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            'text-sm',
                            formMeetingTypes.includes(type.id) ? 'text-blue-700' : 'text-gray-700'
                          )}
                        >
                          {type.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingLink ? 'Save Changes' : 'Add Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
