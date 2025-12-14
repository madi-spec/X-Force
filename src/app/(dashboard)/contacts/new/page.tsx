import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ContactForm } from '@/components/contacts/ContactForm';
import { ArrowLeft } from 'lucide-react';

interface NewContactPageProps {
  searchParams: Promise<{ organization_id?: string }>;
}

export default async function NewContactPage({ searchParams }: NewContactPageProps) {
  const { organization_id: company_id } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get companies for the dropdown
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  const backUrl = company_id
    ? `/organizations/${company_id}`
    : '/contacts';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={backUrl}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Contact</h1>
        <p className="text-gray-500 text-sm mt-1">
          Add a new contact to your CRM
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <ContactForm
          companies={companies || []}
          defaultCompanyId={company_id}
          returnUrl={company_id ? `/organizations/${company_id}` : '/contacts'}
        />
      </div>
    </div>
  );
}
