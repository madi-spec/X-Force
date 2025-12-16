import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ContactForm } from '@/components/contacts/ContactForm';
import { ContactSummaryCard } from '@/components/ai/summaries';
import { ArrowLeft } from 'lucide-react';

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContactPage({ params }: EditContactPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get the contact
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contact) {
    notFound();
  }

  // Get companies for the dropdown
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/companies/${contact.company_id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Company
        </Link>
        <h1 className="text-xl font-normal text-gray-900">Edit Contact</h1>
        <p className="text-gray-500 text-sm mt-1">
          Update contact information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <ContactForm
              contact={contact}
              companies={companies || []}
            />
          </div>
        </div>

        {/* Sidebar - AI Summary */}
        <div className="space-y-6">
          <ContactSummaryCard contactId={id} />
        </div>
      </div>
    </div>
  );
}
