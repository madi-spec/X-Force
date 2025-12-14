import { Inbox, Mail } from 'lucide-react';

export default function InboxPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">
            Your unified email inbox
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Email Integration Coming Soon
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            The inbox feature requires Microsoft Graph API integration.
            Connect your Microsoft 365 account to enable email sync,
            sending, and automatic activity logging.
          </p>
          <p className="text-xs text-gray-400">
            Phase 2 Feature - Email & Calendar Integration
          </p>
        </div>
      </div>
    </div>
  );
}
