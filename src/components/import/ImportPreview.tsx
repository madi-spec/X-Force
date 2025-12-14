'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Play, Building2, Users, DollarSign, MessageSquare, AlertTriangle } from 'lucide-react';
import { cleanCurrencyValue, cleanPhoneNumber, parseDate } from '@/lib/import/dataTransform';

interface ImportPreviewProps {
  rawData: Record<string, string>[];
  columnMapping: Record<string, string>;
  stageMapping: Record<string, string>;
  ownerMapping: Record<string, string>;
  existingCompanies: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  currentUserId: string;
  onPreviewCalculated: (preview: PreviewData) => void;
  onStartImport: () => void;
  onBack: () => void;
}

interface PreviewData {
  companies: number;
  newCompanies: number;
  matchedCompanies: number;
  contacts: number;
  deals: number;
  activities: number;
  skipped: number;
  skippedRows: Array<{ row: number; reason: string }>;
}

interface TransformedRow {
  rowIndex: number;
  company: {
    name: string;
    isNew: boolean;
    existingId?: string;
    status?: string;
    segment?: string;
    industry?: string;
    agentCount?: number;
    crmPlatform?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    role?: string;
    isPrimary?: boolean;
  } | null;
  deal: {
    name?: string;
    stage?: string;
    dealType?: string;
    value?: number;
    ownerId?: string;
    ownerName?: string;
    expectedCloseDate?: string;
    salesTeam?: string;
  } | null;
  activity: {
    note?: string;
    date?: string;
  } | null;
}

export function ImportPreview({
  rawData,
  columnMapping,
  stageMapping,
  ownerMapping,
  existingCompanies,
  users,
  currentUserId,
  onPreviewCalculated,
  onStartImport,
  onBack,
}: ImportPreviewProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'preview' | 'skipped'>('summary');

  // Get the column for a given field
  const getColumnForField = (field: string): string | null => {
    const entry = Object.entries(columnMapping).find(([_, value]) => value === field);
    return entry ? entry[0] : null;
  };

  // Get value from row for a field
  const getFieldValue = (row: Record<string, string>, field: string): string | undefined => {
    const column = getColumnForField(field);
    return column ? row[column]?.trim() : undefined;
  };

  // Transform and analyze all rows
  const { transformedRows, preview } = useMemo(() => {
    const rows: TransformedRow[] = [];
    const skippedRows: Array<{ row: number; reason: string }> = [];
    const companyNames = new Set<string>();
    const newCompanyNames = new Set<string>();
    const matchedCompanyNames = new Set<string>();
    let contactCount = 0;
    let dealCount = 0;
    let activityCount = 0;

    // Build lowercase lookup for existing companies
    const existingCompanyLookup = new Map<string, { id: string; name: string }>();
    existingCompanies.forEach(c => {
      existingCompanyLookup.set(c.name.toLowerCase().trim(), c);
    });

    rawData.forEach((row, index) => {
      const rowIndex = index + 2; // +2 for header row and 1-based indexing

      // Extract company name (required)
      const companyName = getFieldValue(row, 'company_name');
      if (!companyName) {
        skippedRows.push({ row: rowIndex, reason: 'Missing company name' });
        return;
      }

      // Check if company exists
      const existingCompany = existingCompanyLookup.get(companyName.toLowerCase().trim());
      const isNewCompany = !existingCompany;

      if (!companyNames.has(companyName.toLowerCase())) {
        companyNames.add(companyName.toLowerCase());
        if (isNewCompany) {
          newCompanyNames.add(companyName.toLowerCase());
        } else {
          matchedCompanyNames.add(companyName.toLowerCase());
        }
      }

      // Build company object
      const company: TransformedRow['company'] = {
        name: companyName,
        isNew: isNewCompany,
        existingId: existingCompany?.id,
        status: getFieldValue(row, 'company_status'),
        segment: getFieldValue(row, 'company_segment'),
        industry: getFieldValue(row, 'company_industry'),
        agentCount: getFieldValue(row, 'company_agent_count') ? parseInt(getFieldValue(row, 'company_agent_count')!) : undefined,
        crmPlatform: getFieldValue(row, 'company_crm'),
        address: getFieldValue(row, 'company_address'),
        city: getFieldValue(row, 'company_city'),
        state: getFieldValue(row, 'company_state'),
        zip: getFieldValue(row, 'company_zip'),
      };

      // Build contact object
      const contactName = getFieldValue(row, 'contact_name');
      const contactEmail = getFieldValue(row, 'contact_email');
      let contact: TransformedRow['contact'] = null;
      if (contactName || contactEmail) {
        contact = {
          name: contactName,
          email: contactEmail,
          phone: cleanPhoneNumber(getFieldValue(row, 'contact_phone')),
          title: getFieldValue(row, 'contact_title'),
          role: getFieldValue(row, 'contact_role'),
          isPrimary: getFieldValue(row, 'contact_is_primary')?.toLowerCase() === 'true' ||
                     getFieldValue(row, 'contact_is_primary')?.toLowerCase() === 'yes' ||
                     getFieldValue(row, 'contact_is_primary') === '1',
        };
        contactCount++;
      }

      // Build deal object
      const dealName = getFieldValue(row, 'deal_name');
      const dealValue = getFieldValue(row, 'deal_value');
      let deal: TransformedRow['deal'] = null;

      // Get stage from mapping
      const stageColumn = getColumnForField('deal_stage');
      const rawStage = stageColumn ? row[stageColumn]?.trim() : undefined;
      const mappedStage = rawStage ? (stageMapping[rawStage] || stageMapping._default || 'new_lead') : undefined;

      // Get owner from mapping
      const ownerColumn = getColumnForField('deal_owner');
      const rawOwner = ownerColumn ? row[ownerColumn]?.trim() : undefined;
      let ownerId = currentUserId;
      let ownerName = users.find(u => u.id === currentUserId)?.name || 'You';
      if (rawOwner && ownerMapping[rawOwner] && ownerMapping[rawOwner] !== '_unassigned') {
        ownerId = ownerMapping[rawOwner];
        ownerName = users.find(u => u.id === ownerId)?.name || rawOwner;
      } else if (ownerMapping._default) {
        ownerId = ownerMapping._default;
        ownerName = users.find(u => u.id === ownerId)?.name || 'Default';
      }

      if (dealName || dealValue || mappedStage) {
        deal = {
          name: dealName || companyName,
          stage: mappedStage,
          dealType: getFieldValue(row, 'deal_type'),
          value: cleanCurrencyValue(dealValue),
          ownerId,
          ownerName,
          expectedCloseDate: parseDate(getFieldValue(row, 'deal_close_date')),
          salesTeam: getFieldValue(row, 'deal_sales_team'),
        };
        dealCount++;
      }

      // Build activity object
      const activityNote = getFieldValue(row, 'activity_note');
      let activity: TransformedRow['activity'] = null;
      if (activityNote) {
        activity = {
          note: activityNote,
          date: parseDate(getFieldValue(row, 'activity_date')) || new Date().toISOString(),
        };
        activityCount++;
      }

      rows.push({
        rowIndex,
        company,
        contact,
        deal,
        activity,
      });
    });

    const previewData: PreviewData = {
      companies: companyNames.size,
      newCompanies: newCompanyNames.size,
      matchedCompanies: matchedCompanyNames.size,
      contacts: contactCount,
      deals: dealCount,
      activities: activityCount,
      skipped: skippedRows.length,
      skippedRows,
    };

    return { transformedRows: rows, preview: previewData };
  }, [rawData, columnMapping, stageMapping, ownerMapping, existingCompanies, users, currentUserId]);

  // Notify parent of preview data
  useEffect(() => {
    onPreviewCalculated(preview);
  }, [preview, onPreviewCalculated]);

  const previewRows = transformedRows.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Preview Import</h3>
        <p className="text-sm text-gray-500 mt-1">
          Review what will be imported before proceeding
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">{preview.companies}</p>
              <p className="text-sm text-blue-700">Companies</p>
              <p className="text-xs text-blue-600 mt-1">
                {preview.newCompanies} new, {preview.matchedCompanies} existing
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{preview.contacts}</p>
              <p className="text-sm text-green-700">Contacts</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-900">{preview.deals}</p>
              <p className="text-sm text-purple-700">Deals</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-900">{preview.activities}</p>
              <p className="text-sm text-orange-700">Activities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skipped Warning */}
      {preview.skipped > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">
              {preview.skipped} row{preview.skipped !== 1 ? 's' : ''} will be skipped
            </p>
            <p className="text-sm text-amber-700 mt-1">
              These rows are missing required fields and won't be imported
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'summary' as const, label: 'Summary' },
            { id: 'preview' as const, label: `Preview (${previewRows.length} rows)` },
            { id: 'skipped' as const, label: `Skipped (${preview.skipped})`, disabled: preview.skipped === 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : tab.disabled
                  ? 'border-transparent text-gray-300 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Import Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total rows in CSV:</span>
                  <span className="font-medium">{rawData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rows to import:</span>
                  <span className="font-medium text-green-600">{transformedRows.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rows to skip:</span>
                  <span className={`font-medium ${preview.skipped > 0 ? 'text-amber-600' : ''}`}>
                    {preview.skipped}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Import Order</h4>
              <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                <li>Create {preview.newCompanies} new companies (link {preview.matchedCompanies} existing)</li>
                <li>Create {preview.contacts} contacts</li>
                <li>Create {preview.deals} deals</li>
                <li>Create {preview.activities} activities</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            {previewRows.map((row, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Row {row.rowIndex}</span>
                  {row.company?.isNew ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">New Company</span>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Existing Company</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company */}
                  {row.company && (
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">Company</p>
                      <p className="font-medium text-gray-900">{row.company.name}</p>
                      {(row.company.industry || row.company.segment) && (
                        <p className="text-xs text-gray-600 mt-1">
                          {[row.company.industry, row.company.segment].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Contact */}
                  {row.contact && (
                    <div className="bg-green-50 rounded p-3">
                      <p className="text-xs font-medium text-green-700 mb-1">Contact</p>
                      <p className="font-medium text-gray-900">{row.contact.name || '(No name)'}</p>
                      {row.contact.email && (
                        <p className="text-xs text-gray-600 mt-1">{row.contact.email}</p>
                      )}
                    </div>
                  )}

                  {/* Deal */}
                  {row.deal && (
                    <div className="bg-purple-50 rounded p-3">
                      <p className="text-xs font-medium text-purple-700 mb-1">Deal</p>
                      <p className="font-medium text-gray-900">{row.deal.name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {row.deal.stage} • {row.deal.ownerName}
                        {row.deal.value && ` • $${row.deal.value.toLocaleString()}`}
                      </p>
                    </div>
                  )}

                  {/* Activity */}
                  {row.activity && (
                    <div className="bg-orange-50 rounded p-3">
                      <p className="text-xs font-medium text-orange-700 mb-1">Activity</p>
                      <p className="text-sm text-gray-900 line-clamp-2">{row.activity.note}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {transformedRows.length > 10 && (
              <p className="text-center text-sm text-gray-500">
                ...and {transformedRows.length - 10} more rows
              </p>
            )}
          </div>
        )}

        {activeTab === 'skipped' && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.skippedRows.map((skip, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900">{skip.row}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{skip.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onStartImport}
          disabled={transformedRows.length === 0}
          className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="h-4 w-4" />
          Start Import
        </button>
      </div>
    </div>
  );
}
