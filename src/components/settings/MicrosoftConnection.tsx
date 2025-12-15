'use client';

import { useState } from 'react';
import { Mail, Calendar, RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface MicrosoftConnectionProps {
  connection: {
    id: string;
    email: string;
    connected_at: string;
    last_sync_at: string | null;
    is_active: boolean;
    scopes: string[];
  } | null;
}

export function MicrosoftConnection({ connection }: MicrosoftConnectionProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleConnect = () => {
    // Redirect to OAuth flow
    window.location.href = '/api/auth/microsoft';
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Microsoft account? This will stop email and calendar sync.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/microsoft/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/microsoft/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({
          success: true,
          message: `Synced ${data.emailsImported || 0} emails and ${data.eventsImported || 0} calendar events`,
        });
        // Refresh the page after a short delay to update last_sync_at
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Sync failed',
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncResult({
        success: false,
        message: 'Sync failed - please try again',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Check which features are enabled based on scopes
  const hasMailScope = connection?.scopes?.some(s => s.toLowerCase().includes('mail'));
  const hasCalendarScope = connection?.scopes?.some(s => s.toLowerCase().includes('calendar'));

  if (!connection || !connection.is_active) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 23 23" fill="none">
                <path d="M0 0h10.931v10.931H0z" fill="#f25022"/>
                <path d="M12.069 0H23v10.931H12.069z" fill="#7fba00"/>
                <path d="M0 12.069h10.931V23H0z" fill="#00a4ef"/>
                <path d="M12.069 12.069H23V23H12.069z" fill="#ffb900"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Microsoft 365</p>
              <p className="text-sm text-gray-500">Connect to sync emails and calendar</p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Connect
          </button>
        </div>

        <div className="text-sm text-gray-500 space-y-2">
          <p>Connecting your Microsoft 365 account enables:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Automatic email sync with contacts and deals</li>
            <li>Calendar event tracking and meeting scheduling</li>
            <li>Send emails directly from X-FORCE</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Account */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Connected to Microsoft 365</p>
            <p className="text-sm text-gray-600">{connection.email}</p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {isDisconnecting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Disconnecting...
            </span>
          ) : (
            'Disconnect'
          )}
        </button>
      </div>

      {/* Features Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={cn(
          'p-3 rounded-lg border flex items-center gap-3',
          hasMailScope ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
        )}>
          <Mail className={cn('h-5 w-5', hasMailScope ? 'text-green-600' : 'text-gray-400')} />
          <div>
            <p className="font-medium text-gray-900">Email Sync</p>
            <p className="text-sm text-gray-500">
              {hasMailScope ? 'Enabled' : 'Not enabled'}
            </p>
          </div>
        </div>

        <div className={cn(
          'p-3 rounded-lg border flex items-center gap-3',
          hasCalendarScope ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
        )}>
          <Calendar className={cn('h-5 w-5', hasCalendarScope ? 'text-green-600' : 'text-gray-400')} />
          <div>
            <p className="font-medium text-gray-900">Calendar Sync</p>
            <p className="text-sm text-gray-500">
              {hasCalendarScope ? 'Enabled' : 'Not enabled'}
            </p>
          </div>
        </div>
      </div>

      {/* Sync Status and Actions */}
      <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Last Synced</p>
            <p className="text-sm text-gray-500">
              {connection.last_sync_at
                ? formatDate(connection.last_sync_at)
                : 'Never synced'}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
          >
            {isSyncing ? (
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
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg text-sm',
            syncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}>
            {syncResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {syncResult.message}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Connected on {formatDate(connection.connected_at)}. Automatic sync runs every 15 minutes.
        </p>
      </div>
    </div>
  );
}
