import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Building2, Edit2, Mail, Phone, Plus } from 'lucide-react';

const roleLabels: Record<string, string> = {
  decision_maker: 'Decision Maker',
  influencer: 'Influencer',
  champion: 'Champion',
  end_user: 'End User',
  blocker: 'Blocker',
};

export default async function ContactsPage() {
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      *,
      company:companies(id, name)
    `)
    .order('name');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Contacts</h1>
          <p className="text-xs text-gray-500 mt-1">
            {contacts?.length || 0} contacts
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Contact
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Info
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts?.map((contact) => (
              <tr key={contact.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {contact.name}
                      {contact.is_primary && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </p>
                    {contact.title && (
                      <p className="text-sm text-gray-500">{contact.title}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {contact.company && (
                    <Link
                      href={`/companies/${contact.company.id}`}
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {contact.company.name}
                    </Link>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {contact.role ? roleLabels[contact.role] || contact.role : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
                      >
                        <Mail className="h-4 w-4" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
                      >
                        <Phone className="h-4 w-4" />
                        {contact.phone}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/contacts/${contact.id}/edit`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(!contacts || contacts.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No contacts yet. Add your first contact to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
