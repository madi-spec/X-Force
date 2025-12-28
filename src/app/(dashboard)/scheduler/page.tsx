import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Calendar, Settings } from 'lucide-react';
import Link from 'next/link';
import { UnifiedCalendarClient } from '../calendar/unified-calendar-client';

export default async function SchedulerPage() {
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

  // Get meeting activities for the user
  const { data: meetingActivities } = await supabase
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
    .eq('type', 'meeting')
    .eq('user_id', profile.id)
    .order('occurred_at', { ascending: false })
    .limit(100);

  // If not connected, show setup prompt
  if (!isConnected) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-normal text-gray-900">Scheduler</h1>
            <p className="text-xs text-gray-500 mt-1">
              AI-powered meeting scheduling
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
          <div className="text-center max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-base font-medium text-gray-900 mb-2">
              Connect Microsoft 365
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Connect your Microsoft 365 account to enable AI scheduling.
              The scheduler will check your calendar availability and send meeting requests automatically.
            </p>
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
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
  const events = (meetingActivities || []).map(activity => {
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
      description: activity.body || '',
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
        location?: string;
        is_online?: boolean;
        join_url?: string;
        attendees?: Array<{ email: string; name?: string; response?: string }>;
        start_time?: string;
        end_time?: string;
        has_contact?: boolean;
      },
    };
  });

  return (
    <div className="h-[calc(100vh-8rem)]">
      <UnifiedCalendarClient events={events} defaultView="scheduler" />
    </div>
  );
}
