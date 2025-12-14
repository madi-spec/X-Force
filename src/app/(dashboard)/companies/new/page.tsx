import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CompanyForm } from '@/components/companies/CompanyForm';

export default function NewCompanyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Company</h1>
        <p className="text-gray-500 text-sm mt-1">
          Add a new company to track
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <CompanyForm />
      </div>
    </div>
  );
}
