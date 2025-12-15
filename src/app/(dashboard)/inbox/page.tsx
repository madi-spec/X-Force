import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Mail, Settings } from 'lucide-react';
import Link from 'next/link';
import { InboxClient } from './inbox-client';

export default async function InboxPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Check if user has Microsoft connection
  const { data: microsoftConnection } = await supabase
    .from('microsoft_connections')
    .select('id, is_active, last_sync_at')
    .eq('user_id', profile.id)
    .single();

  const isConnected = microsoftConnection?.is_active ?? false;

  // Get email activities for the user
  const { data: emailActivities } = await supabase
    .from('activities')
    .select(`
      id,
      subject,
      body,
      occurred_at,
      metadata,
      contact:contacts(
        id,
        name,
        email,
        company:companies(id, name)
      ),
      deal:deals(id, name)
    `)
    .in('type', ['email_sent', 'email_received'])
    .eq('user_id', profile.id)
    .order('occurred_at', { ascending: false })
    .limit(100);

  // If not connected, show setup prompt
  if (!isConnected) {
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
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Connect Microsoft 365
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Connect your Microsoft 365 account to sync emails and calendar events.
              Your emails will appear here and be automatically linked to contacts and deals.
            </p>
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Settings className="h-4 w-4" />
              Connect Microsoft 365
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Transform the data for the client component
  // Supabase returns relations as arrays, need to extract first item
  const emails = (emailActivities || []).map(activity => {
    // Handle contact (could be array or single object depending on Supabase version)
    const contactData = Array.isArray(activity.contact)
      ? activity.contact[0]
      : activity.contact;

    // Handle company inside contact
    const companyData = contactData?.company
      ? (Array.isArray(contactData.company) ? contactData.company[0] : contactData.company)
      : null;

    // Handle deal
    const dealData = Array.isArray(activity.deal)
      ? activity.deal[0]
      : activity.deal;

    return {
      id: activity.id,
      subject: activity.subject || '',
      body: activity.body || '',
      occurred_at: activity.occurred_at || new Date().toISOString(),
      contact: contactData ? {
        id: contactData.id,
        name: contactData.name,
        email: contactData.email || '',
        company: companyData ? {
          id: companyData.id,
          name: companyData.name,
        } : undefined,
      } : null,
      deal: dealData ? {
        id: dealData.id,
        name: dealData.name,
      } : null,
      metadata: (activity.metadata || {}) as {
        direction?: 'inbound' | 'outbound';
        from?: { address: string; name?: string };
        to?: Array<{ address: string; name?: string }>;
        has_contact?: boolean;
      },
    };
  });

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">
            {emails.length} synced emails
            {microsoftConnection?.last_sync_at && (
              <span className="text-gray-400">
                {' '}· Last synced {new Date(microsoftConnection.last_sync_at).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/settings/integrations"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Manage connection
        </Link>
      </div>

      <InboxClient emails={emails} />
    </div>
  );
}
