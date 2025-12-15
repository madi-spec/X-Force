'use client';

import { useState, useEffect } from 'react';
import { Mic, RefreshCw, Check, AlertCircle, Loader2, Settings, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface FirefliesConnectionStatus {
  connected: boolean;
  connection?: {
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
    transcriptsSynced: number;
    autoAnalyze: boolean;
    autoCreateDrafts: boolean;
    autoCreateTasks: boolean;
  };
}

export function FirefliesIntegration() {
  const [status, setStatus] = useState<FirefliesConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Settings state
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [autoCreateDrafts, setAutoCreateDrafts] = useState(true);
  const [autoCreateTasks, setAutoCreateTasks] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/integrations/fireflies/status');
      const data = await res.json();
      setStatus(data);

      // Initialize settings from connection
      if (data.connection) {
        setAutoAnalyze(data.connection.autoAnalyze ?? true);
        setAutoCreateDrafts(data.connection.autoCreateDrafts ?? true);
        setAutoCreateTasks(data.connection.autoCreateTasks ?? true);
      }
    } catch (err) {
      console.error('Failed to fetch Fireflies status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const res = await fetch('/api/integrations/fireflies/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          autoAnalyze,
          autoCreateDrafts,
          autoCreateTasks,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        setApiKey('');
        fetchStatus();
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      console.error('Connect error:', err);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Fireflies? Your synced transcripts will remain.')) {
      return;
    }

    try {
      const res = await fetch('/api/integrations/fireflies/connect', {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowModal(false);
        fetchStatus();
      } else {
        alert('Failed to disconnect');
      }
    } catch (err) {
      alert('Failed to disconnect');
      console.error('Disconnect error:', err);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/integrations/fireflies/sync', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        setSyncResult({
          success: true,
          message: `Synced ${data.synced} transcript${data.synced !== 1 ? 's' : ''}, ${data.analyzed} analyzed`,
        });
        // Refresh status after a short delay
        setTimeout(fetchStatus, 2000);
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Sync failed',
        });
      }
    } catch (err) {
      setSyncResult({
        success: false,
        message: 'Sync failed. Please try again.',
      });
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveSettings() {
    try {
      const res = await fetch('/api/integrations/fireflies/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoAnalyze,
          autoCreateDrafts,
          autoCreateTasks,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-48 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Disconnected state
  if (!status?.connected) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Mic className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Fireflies.ai</p>
                <p className="text-sm text-gray-500">Auto-sync meeting transcripts</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Connect
            </button>
          </div>

          <div className="text-sm text-gray-500 space-y-2">
            <p>Connecting your Fireflies.ai account enables:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Automatic meeting transcript sync</li>
              <li>AI analysis of meeting content</li>
              <li>Auto-generated follow-up emails and tasks</li>
            </ul>
          </div>
        </div>

        {/* Connect Modal */}
        {showModal && (
          <ConnectModal
            apiKey={apiKey}
            setApiKey={setApiKey}
            autoAnalyze={autoAnalyze}
            setAutoAnalyze={setAutoAnalyze}
            autoCreateDrafts={autoCreateDrafts}
            setAutoCreateDrafts={setAutoCreateDrafts}
            autoCreateTasks={autoCreateTasks}
            setAutoCreateTasks={setAutoCreateTasks}
            connecting={connecting}
            error={error}
            onConnect={handleConnect}
            onClose={() => {
              setShowModal(false);
              setApiKey('');
              setError('');
            }}
          />
        )}
      </>
    );
  }

  // Connected state
  return (
    <>
      <div className="space-y-4">
        {/* Connected Card */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Connected to Fireflies.ai</p>
              <p className="text-sm text-gray-600">
                {status.connection?.transcriptsSynced || 0} transcripts synced
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FeatureBadge
            enabled={status.connection?.autoAnalyze ?? true}
            label="AI Analysis"
          />
          <FeatureBadge
            enabled={status.connection?.autoCreateDrafts ?? true}
            label="Auto Email Drafts"
          />
          <FeatureBadge
            enabled={status.connection?.autoCreateTasks ?? true}
            label="Auto Tasks"
          />
        </div>

        {/* Sync Status */}
        <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Last Synced</p>
              <p className="text-sm text-gray-500">
                {status.connection?.lastSyncAt
                  ? formatDate(status.connection.lastSyncAt)
                  : 'Never synced'}
              </p>
              {status.connection?.lastSyncStatus === 'error' && status.connection?.lastSyncError && (
                <p className="text-xs text-red-500 mt-1">
                  Error: {status.connection.lastSyncError}
                </p>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync Now
                </>
              )}
            </button>
          </div>

          {syncResult && (
            <div
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-sm',
                syncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              )}
            >
              {syncResult.success ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {syncResult.message}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Automatic sync runs every 30 minutes via cron job.
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      {showModal && (
        <SettingsModal
          autoAnalyze={autoAnalyze}
          setAutoAnalyze={setAutoAnalyze}
          autoCreateDrafts={autoCreateDrafts}
          setAutoCreateDrafts={setAutoCreateDrafts}
          autoCreateTasks={autoCreateTasks}
          setAutoCreateTasks={setAutoCreateTasks}
          onSave={handleSaveSettings}
          onDisconnect={handleDisconnect}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function FeatureBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div
      className={cn(
        'p-2 rounded-lg border flex items-center gap-2 text-sm',
        enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
      )}
    >
      {enabled ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-gray-400" />
      )}
      <span className={enabled ? 'text-green-700' : 'text-gray-500'}>{label}</span>
    </div>
  );
}

function ConnectModal({
  apiKey,
  setApiKey,
  autoAnalyze,
  setAutoAnalyze,
  autoCreateDrafts,
  setAutoCreateDrafts,
  autoCreateTasks,
  setAutoCreateTasks,
  connecting,
  error,
  onConnect,
  onClose,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  autoAnalyze: boolean;
  setAutoAnalyze: (v: boolean) => void;
  autoCreateDrafts: boolean;
  setAutoCreateDrafts: (v: boolean) => void;
  autoCreateTasks: boolean;
  setAutoCreateTasks: (v: boolean) => void;
  connecting: boolean;
  error: string;
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Connect Fireflies.ai</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          To connect, get your API key from{' '}
          <a
            href="https://app.fireflies.ai/integrations/custom/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline"
          >
            Fireflies Developer Settings
          </a>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ff_xxxxxxxxxxxxxxxx"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm">Auto-analyze new transcripts with AI</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateDrafts}
                onChange={(e) => setAutoCreateDrafts(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm">Auto-create follow-up email drafts</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateTasks}
                onChange={(e) => setAutoCreateTasks(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm">Auto-create tasks from action items</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConnect}
            disabled={connecting || !apiKey.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  autoAnalyze,
  setAutoAnalyze,
  autoCreateDrafts,
  setAutoCreateDrafts,
  autoCreateTasks,
  setAutoCreateTasks,
  onSave,
  onDisconnect,
  onClose,
}: {
  autoAnalyze: boolean;
  setAutoAnalyze: (v: boolean) => void;
  autoCreateDrafts: boolean;
  setAutoCreateDrafts: (v: boolean) => void;
  autoCreateTasks: boolean;
  setAutoCreateTasks: (v: boolean) => void;
  onSave: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Fireflies Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAnalyze}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Auto-analyze new transcripts with AI</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateDrafts}
              onChange={(e) => setAutoCreateDrafts(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Auto-create follow-up email drafts</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateTasks}
              onChange={(e) => setAutoCreateTasks(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Auto-create tasks from action items</span>
          </label>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onDisconnect}
            className="text-red-600 hover:text-red-700 hover:underline text-sm"
          >
            Disconnect
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
