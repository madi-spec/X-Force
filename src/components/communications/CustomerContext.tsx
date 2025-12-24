'use client';

import useSWR from 'swr';
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Package,
  Calendar,
  MessageSquare,
  TrendingUp,
  Target
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface CustomerContextProps {
  companyId: string | null;
  contactId?: string | null;
}

interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
}

interface Contact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

interface Deal {
  id: string;
  name: string;
  value?: number;
  stage?: string;
  expected_close_date?: string;
}

interface Stats {
  total_communications: number;
  inbound: number;
  outbound: number;
  products_discussed: string[];
  recent_signals: Array<{ signal: string; type: string }>;
  avg_response_time: string;
}

export function CustomerContext({ companyId, contactId }: CustomerContextProps) {
  // Fetch company details
  const { data: companyData } = useSWR<{ company: Company }>(
    companyId ? `/api/companies/${companyId}` : null,
    fetcher
  );

  // Fetch contact details if specific contact selected
  const { data: contactData } = useSWR<{ contact: Contact }>(
    contactId ? `/api/contacts/${contactId}` : null,
    fetcher
  );

  // Fetch deals for this company
  const { data: dealsData } = useSWR<{ deals: Deal[] }>(
    companyId ? `/api/deals?company_id=${companyId}` : null,
    fetcher
  );

  // Fetch communication stats
  const { data: statsData } = useSWR<{ stats: Stats }>(
    companyId ? `/api/communications/stats?company_id=${companyId}` : null,
    fetcher
  );

  const company = companyData?.company;
  const contact = contactData?.contact;
  const deals = dealsData?.deals || [];
  const stats = statsData?.stats;
  const activeDeal = deals.find((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');

  if (!companyId) {
    return (
      <div className="w-80 border-l bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-400 text-center">
          Select a conversation to see customer details
        </p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-white overflow-y-auto">
      {/* Contact/Company Header */}
      <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            {contact ? (
              <User className="w-6 h-6 text-blue-600" />
            ) : (
              <Building2 className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {contact?.name || company?.name || 'Loading...'}
            </h3>
            {contact && (
              <p className="text-sm text-gray-500">{contact.title || 'Contact'}</p>
            )}
            {contact && company && (
              <p className="text-xs text-gray-400">{company.name}</p>
            )}
          </div>
        </div>

        {/* Quick Contact Info */}
        <div className="space-y-1.5 text-sm">
          {(contact?.email || company?.email) && (
            <a
              href={`mailto:${contact?.email || company?.email}`}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Mail className="w-4 h-4" />
              <span className="truncate">{contact?.email || company?.email}</span>
            </a>
          )}
          {(contact?.phone || company?.phone) && (
            <a
              href={`tel:${contact?.phone || company?.phone}`}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Phone className="w-4 h-4" />
              {contact?.phone || company?.phone}
            </a>
          )}
          {company?.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Globe className="w-4 h-4" />
              <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      </div>

      {/* Active Deal */}
      {activeDeal && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Active Deal
          </h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900 mb-1">{activeDeal.name}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Value: </span>
                <span className="font-medium text-green-600">
                  ${activeDeal.value?.toLocaleString()}/yr
                </span>
              </div>
              <div>
                <span className="text-gray-500">Stage: </span>
                <span className="font-medium text-gray-700 capitalize">
                  {activeDeal.stage?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            {activeDeal.expected_close_date && (
              <div className="mt-2 text-xs text-gray-500">
                Expected close: {new Date(activeDeal.expected_close_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Discussed */}
      {stats?.products_discussed && stats.products_discussed.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products Discussed
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.products_discussed.map((product) => (
              <span
                key={product}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg"
              >
                {product}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Communication Stats */}
      {stats && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Communication Stats
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total_communications || 0}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.avg_response_time || '-'}</p>
              <p className="text-xs text-gray-500">Avg Response</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.inbound || 0}</p>
              <p className="text-xs text-gray-500">Inbound</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.outbound || 0}</p>
              <p className="text-xs text-gray-500">Outbound</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Signals */}
      {stats?.recent_signals && stats.recent_signals.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Recent Signals
          </h4>
          <div className="space-y-2">
            {stats.recent_signals.map((signal, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-lg text-sm ${
                  signal.type === 'positive'
                    ? 'bg-green-50 text-green-700'
                    : signal.type === 'negative'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-gray-50 text-gray-700'
                }`}
              >
                {signal.signal.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          Quick Actions
        </h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Send Email
          </button>
          <button className="w-full px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule Meeting
          </button>
          <button className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
