'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Loader2,
  Mail,
  User,
  Building2,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Asset {
  id: string;
  name: string;
  type: 'document' | 'video' | 'image' | 'link';
  url: string;
}

interface RoomData {
  id: string;
  slug: string;
  dealName: string;
  companyName: string | null;
  companyLogo: string | null;
  assets: Asset[];
}

const assetTypeIcons: Record<string, typeof FileText> = {
  document: FileText,
  video: Video,
  image: ImageIcon,
  link: ExternalLink,
};

const assetTypeColors: Record<string, string> = {
  document: 'bg-blue-100 text-blue-600',
  video: 'bg-purple-100 text-purple-600',
  image: 'bg-green-100 text-green-600',
  link: 'bg-amber-100 text-amber-600',
};

export default function PublicRoomPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Email gate state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Check localStorage for saved access
  useEffect(() => {
    const savedEmail = localStorage.getItem(`room_${slug}_email`);
    if (savedEmail) {
      setEmail(savedEmail);
      setHasAccess(true);
    }
  }, [slug]);

  // Fetch room data
  useEffect(() => {
    async function fetchRoom() {
      try {
        const response = await fetch(`/api/public/rooms/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Room not found');
          } else {
            setError('Failed to load room');
          }
          return;
        }
        const data = await response.json();
        setRoom(data.room);
      } catch {
        setError('Failed to load room');
      } finally {
        setLoading(false);
      }
    }

    fetchRoom();
  }, [slug]);

  // Handle email submission
  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);

    try {
      // Record initial view
      await fetch(`/api/public/rooms/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null }),
      });

      // Save to localStorage
      localStorage.setItem(`room_${slug}_email`, email.trim());
      if (name.trim()) {
        localStorage.setItem(`room_${slug}_name`, name.trim());
      }

      setHasAccess(true);
    } catch {
      setEmailError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [email, name, slug]);

  // Handle asset click - record view
  const handleAssetClick = useCallback(async (asset: Asset) => {
    // Record asset view
    try {
      await fetch(`/api/public/rooms/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: localStorage.getItem(`room_${slug}_email`) || email,
          name: localStorage.getItem(`room_${slug}_name`) || name || null,
          assetId: asset.id,
        }),
      });
    } catch {
      // Silently fail - don't block the user
    }

    // Open asset
    window.open(asset.url, '_blank', 'noopener,noreferrer');
  }, [email, name, slug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Room Not Found</h1>
          <p className="text-gray-500">This room may have been removed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  // Email gate
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          {/* Company branding */}
          <div className="text-center mb-8">
            {room.companyLogo ? (
              <img
                src={room.companyLogo}
                alt={room.companyName || ''}
                className="h-12 mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
            )}
            <h1 className="text-xl font-semibold text-gray-900">{room.dealName}</h1>
            {room.companyName && (
              <p className="text-gray-500 mt-1">{room.companyName}</p>
            )}
          </div>

          {/* Access form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <p className="text-sm text-gray-600 text-center mb-6">
              Enter your email to access the shared resources.
            </p>

            {emailError && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
                {emailError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Please wait...' : 'Access Room'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main room view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {room.companyLogo ? (
              <img
                src={room.companyLogo}
                alt={room.companyName || ''}
                className="h-10 object-contain"
              />
            ) : (
              <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{room.dealName}</h1>
              {room.companyName && (
                <p className="text-sm text-gray-500">{room.companyName}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {room.assets.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">No resources yet</h2>
            <p className="text-gray-500">Check back later for shared content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {room.assets.map((asset) => {
              const Icon = assetTypeIcons[asset.type];
              const colorClass = assetTypeColors[asset.type];

              return (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-3 rounded-lg', colorClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                        {asset.name}
                      </p>
                      <p className="text-sm text-gray-500 capitalize mt-0.5">
                        {asset.type}
                      </p>
                    </div>
                    {asset.type === 'link' ? (
                      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                    ) : (
                      <Download className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 py-3">
        <p className="text-center text-xs text-gray-400">
          Powered by X-FORCE
        </p>
      </div>
    </div>
  );
}
