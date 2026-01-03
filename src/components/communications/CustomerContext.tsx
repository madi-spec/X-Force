'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  Building2,
  User,
  Mail,
  Calendar,
  UserPlus,
  AlertCircle,
  Package,
  Users,
  Hash,
  Video,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  Sparkles,
  Phone,
  Plus,
  Edit2
} from 'lucide-react';
import { CreateLeadFromEmail } from './CreateLeadFromEmail';
import { ComposeModal } from '@/components/inbox/ComposeModal';
import { ScheduleMeetingModal } from '@/components/scheduler/ScheduleMeetingModal';
import { QuickBookModal } from '@/components/scheduler/QuickBookModal';
import { AddContactModal, NewContact } from '@/components/commandCenter/AddContactModal';
import { ManageProductsModal } from '@/components/dailyDriver/ManageProductsModal';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface CustomerContextProps {
  companyId: string | null;
  contactId?: string | null;
  senderEmail?: string | null;
  onLeadCreated?: () => void;
}

interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  vfp_customer_id?: string | null;
  ats_id?: string | null;
  voice_customer?: boolean;
  vfp_support_contact?: string | null;
}

interface Contact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
}

interface CompanyProduct {
  id: string;
  status: string;
  product?: {
    id: string;
    name: string;
    slug: string;
  };
  current_stage?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
  owner_user_id?: string | null;
}

interface SchedulingRequest {
  id: string;
  title: string;
  status: string;
  scheduled_time?: string;
  meeting_type: string;
  duration_minutes: number;
}

interface MeetingActivity {
  id: string;
  subject: string | null;
  occurred_at: string;
  metadata: {
    start_time?: string;
    end_time?: string;
    is_online_meeting?: boolean;
    join_url?: string;
    attendees?: Array<{ name?: string; email?: string }>;
  } | null;
  contact?: {
    id: string;
    name: string;
    email?: string;
  };
}

// Status badge colors
const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  customer: { bg: 'bg-green-100', text: 'text-green-700' },
  in_sales: { bg: 'bg-blue-100', text: 'text-blue-700' },
  onboarding: { bg: 'bg-purple-100', text: 'text-purple-700' },
  churned: { bg: 'bg-gray-100', text: 'text-gray-600' },
  declined: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function CustomerContext({ companyId, contactId, senderEmail, onLeadCreated }: CustomerContextProps) {
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showAIScheduler, setShowAIScheduler] = useState(false);
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showManageProducts, setShowManageProducts] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Fetch company details
  const { data: companyData } = useSWR<{ company: Company }>(
    companyId ? `/api/companies/${companyId}` : null,
    fetcher
  );

  // Fetch contacts for this company
  const { data: contactsData, mutate: mutateContacts } = useSWR<{ contacts: Contact[] }>(
    companyId ? `/api/contacts?company_id=${companyId}` : null,
    fetcher
  );

  // Fetch company products
  const { data: productsData, mutate: mutateProducts } = useSWR<{ companyProducts: CompanyProduct[] }>(
    companyId ? `/api/companies/${companyId}/products` : null,
    fetcher
  );

  // Fetch upcoming meetings from activities table
  const { data: meetingsData } = useSWR<{ activities: MeetingActivity[] }>(
    companyId ? `/api/activities?company_id=${companyId}&type=meeting&upcoming=true&limit=5` : null,
    fetcher
  );

  // For unlinked: fetch communications by sender email
  const { data: unlinkedCommsData } = useSWR<{ communications: Array<{ id: string }> }>(
    !companyId && senderEmail ? `/api/communications?sender_email=${encodeURIComponent(senderEmail)}&limit=1` : null,
    fetcher
  );

  const company = companyData?.company;
  const contacts = contactsData?.contacts || [];
  const products = productsData?.companyProducts || [];
  const meetings = meetingsData?.activities || [];

  // Separate products by status
  const activeProducts = products.filter(p => p.status === 'active' || p.status === 'customer');
  const inSalesProducts = products.filter(p => p.status === 'in_sales');
  const otherProducts = products.filter(p => !['active', 'customer', 'in_sales'].includes(p.status));

  // Get success rep from company's vfp_support_contact field
  const successRep = company?.vfp_support_contact && company.vfp_support_contact !== 'None'
    ? company.vfp_support_contact
    : null;

  // Unlinked communication view - show create lead option
  if (!companyId && senderEmail) {
    const communicationId = unlinkedCommsData?.communications?.[0]?.id;
    const domain = senderEmail.split('@')[1];

    return (
      <div className="w-80 h-full border-l bg-white overflow-y-auto flex flex-col">
        {/* Unlinked Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Unlinked</h3>
              <p className="text-xs text-gray-500">{domain}</p>
            </div>
          </div>

          {/* Sender Info */}
          <div className="text-sm text-gray-600 truncate">
            <Mail className="w-3.5 h-3.5 inline mr-1.5" />
            {senderEmail}
          </div>
        </div>

        {/* Create Lead Section */}
        <div className="p-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5" />
            Create Lead
          </h4>

          {communicationId ? (
            <CreateLeadFromEmail
              communicationId={communicationId}
              onLeadCreated={() => onLeadCreated?.()}
            />
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              Loading...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="w-80 h-full border-l bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-400 text-center text-sm">
          Select a conversation to see details
        </p>
      </div>
    );
  }

  // Determine primary contact
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
  const displayedContacts = showAllContacts ? contacts : contacts.slice(0, 3);

  return (
    <div className="w-80 h-full border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
      {/* Company Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {company?.name || 'Loading...'}
            </h3>
            {company?.voice_customer && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                VFP Customer
              </span>
            )}
          </div>
        </div>

        {/* Success Rep - Prominent display for scheduling context */}
        {successRep && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
            <User className="w-4 h-4 text-blue-600" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-blue-600 font-medium uppercase tracking-wider">Success Rep</span>
              <p className="text-sm font-semibold text-gray-900 truncate">{successRep}</p>
            </div>
          </div>
        )}
      </div>

      {/* Rev & ATS IDs */}
      {(company?.vfp_customer_id || company?.ats_id) && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-xs">
            {company.vfp_customer_id && (
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Rev:</span>
                <span className="font-mono font-medium text-gray-700">
                  {company.vfp_customer_id}
                </span>
              </div>
            )}
            {company.ats_id && (
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">ATS:</span>
                <span className="font-mono font-medium text-gray-700">
                  {company.ats_id}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Contacts
            {contacts.length > 0 && (
              <span className="text-gray-400">{contacts.length}</span>
            )}
          </h4>
          <button
            onClick={() => setShowAddContact(true)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Add contact"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No contacts</p>
        ) : (
          <div className="space-y-2">
            {displayedContacts.map((contact) => (
              <div
                key={contact.id}
                className={cn(
                  'p-2 rounded-lg group',
                  contact.is_primary
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contact.name}
                      {contact.is_primary && (
                        <span className="ml-1.5 text-xs text-blue-600">(Primary)</span>
                      )}
                    </p>
                    {contact.title && (
                      <p className="text-xs text-gray-500 truncate">{contact.title}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingContact(contact)}
                    className="p-1 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit contact"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-xs text-gray-500 hover:text-blue-600 truncate block mt-1"
                  >
                    {contact.email}
                  </a>
                )}
              </div>
            ))}

            {contacts.length > 3 && (
              <button
                onClick={() => setShowAllContacts(!showAllContacts)}
                className="w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1"
              >
                {showAllContacts ? (
                  <>Show less <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Show {contacts.length - 3} more <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Products Section */}
      {activeProducts.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-3.5 h-3.5" />
              Active Products
              <span className="text-gray-400">{activeProducts.length}</span>
            </h4>
            <button
              onClick={() => setShowManageProducts(true)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Manage products"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {activeProducts.map((cp) => (
              <div key={cp.id} className="p-2 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {cp.product?.name || 'Unknown Product'}
                  </span>
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In Sales Products Section */}
      {inSalesProducts.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            In Sales Cycle
            <span className="ml-auto text-gray-400">{inSalesProducts.length}</span>
          </h4>

          <div className="space-y-2">
            {inSalesProducts.map((cp) => (
              <div key={cp.id} className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {cp.product?.name || 'Unknown Product'}
                  </span>
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                    In Sales
                  </span>
                </div>
                {cp.current_stage && (
                  <p className="text-xs text-blue-600 mt-1">
                    Stage: {cp.current_stage.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Products (churned, declined, onboarding) */}
      {otherProducts.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="w-3.5 h-3.5" />
            Other Products
            <span className="ml-auto text-gray-400">{otherProducts.length}</span>
          </h4>

          <div className="space-y-2">
            {otherProducts.map((cp) => {
              const colors = statusColors[cp.status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
              return (
                <div key={cp.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {cp.product?.name || 'Unknown Product'}
                    </span>
                    <span className={cn(
                      'px-1.5 py-0.5 text-xs font-medium rounded capitalize',
                      colors.bg, colors.text
                    )}>
                      {cp.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Show empty state if no products at all */}
      {products.length === 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-3.5 h-3.5" />
              Products
            </h4>
            <button
              onClick={() => setShowManageProducts(true)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Manage products"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-400 italic">No products</p>
        </div>
      )}

      {/* Upcoming Meetings Section */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          Upcoming Meetings
        </h4>

        {meetings.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No scheduled meetings</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((meeting) => {
              const startTime = meeting.metadata?.start_time || meeting.occurred_at;
              const endTime = meeting.metadata?.end_time;
              const durationMinutes = startTime && endTime
                ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
                : null;

              return (
                <div key={meeting.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Video className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {meeting.subject || 'Meeting'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(startTime), 'MMM d, h:mm a')}
                        {durationMinutes && (
                          <span className="text-gray-400 ml-1">
                            ({durationMinutes}m)
                          </span>
                        )}
                      </p>
                      {meeting.contact && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          with {meeting.contact.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h4>
        <div className="space-y-2">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Send Email
          </button>

          {/* Schedule Meeting Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowScheduleMenu(!showScheduleMenu)}
              className="w-full px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Schedule Meeting
              <ChevronUp className={cn("w-3 h-3 ml-1 transition-transform", !showScheduleMenu && "rotate-180")} />
            </button>
            {showScheduleMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowScheduleMenu(false)}
                />
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setShowAIScheduler(true);
                      setShowScheduleMenu(false);
                    }}
                    className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">AI Scheduler</div>
                      <div className="text-xs text-gray-500">AI drafts email & handles replies</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickBook(true);
                      setShowScheduleMenu(false);
                    }}
                    className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <Phone className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Quick Book</div>
                      <div className="text-xs text-gray-500">Book now while on a call</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          <a
            href={`/companies/${companyId}`}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View Company
          </a>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          isOpen={true}
          onClose={() => setShowCompose(false)}
          onSent={() => setShowCompose(false)}
          toEmail={primaryContact?.email}
          toName={primaryContact?.name}
          companyId={companyId}
        />
      )}

      {/* AI Scheduler Modal */}
      <ScheduleMeetingModal
        isOpen={showAIScheduler}
        onClose={() => setShowAIScheduler(false)}
        onSuccess={() => setShowAIScheduler(false)}
        companyId={companyId || undefined}
        contactName={primaryContact?.name}
        contactEmail={primaryContact?.email}
      />

      {/* Quick Book Modal */}
      <QuickBookModal
        isOpen={showQuickBook}
        onClose={() => setShowQuickBook(false)}
        onSuccess={() => setShowQuickBook(false)}
        companyId={companyId || undefined}
        contactName={primaryContact?.name}
        contactEmail={primaryContact?.email}
      />

      {/* Add/Edit Contact Modal */}
      <AddContactModal
        isOpen={showAddContact || !!editingContact}
        onClose={() => {
          setShowAddContact(false);
          setEditingContact(null);
        }}
        onContactAdded={() => {
          mutateContacts();
          setShowAddContact(false);
          setEditingContact(null);
        }}
        companyId={companyId || undefined}
        companyName={company?.name}
        contact={editingContact ? {
          id: editingContact.id,
          name: editingContact.name,
          email: editingContact.email || '',
          title: editingContact.title,
          phone: editingContact.phone,
        } : null}
      />

      {/* Manage Products Modal */}
      {companyId && company && (
        <ManageProductsModal
          isOpen={showManageProducts}
          onClose={() => setShowManageProducts(false)}
          companyId={companyId}
          companyName={company.name}
          onUpdated={() => mutateProducts()}
        />
      )}
    </div>
  );
}
