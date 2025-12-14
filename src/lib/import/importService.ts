import { createClient } from '@/lib/supabase/client';
import { cleanCurrencyValue, cleanPhoneNumber, parseDate, parseBoolean } from './dataTransform';

interface ImportOptions {
  rawData: Record<string, string>[];
  columnMapping: Record<string, string>;
  stageMapping: Record<string, string>;
  ownerMapping: Record<string, string>;
  existingCompanies: Array<{ id: string; name: string }>;
  currentUserId: string;
  onProgress: (update: {
    phase: 'companies' | 'contacts' | 'deals' | 'activities';
    current: number;
    total: number;
    action: string;
  }) => void;
}

interface ImportResult {
  results: {
    companies: number;
    contacts: number;
    deals: number;
    activities: number;
  };
  errors: Array<{ row: number; message: string }>;
}

export async function importData(options: ImportOptions): Promise<ImportResult> {
  const {
    rawData,
    columnMapping,
    stageMapping,
    ownerMapping,
    existingCompanies,
    currentUserId,
    onProgress,
  } = options;

  const supabase = createClient();
  const errors: Array<{ row: number; message: string }> = [];
  const results = { companies: 0, contacts: 0, deals: 0, activities: 0 };

  // Build company name lookup
  const companyIdMap = new Map<string, string>();
  existingCompanies.forEach((c) => {
    companyIdMap.set(c.name.toLowerCase().trim(), c.id);
  });

  // Helper to get column value
  const getField = (row: Record<string, string>, field: string): string | undefined => {
    const col = Object.entries(columnMapping).find(([, v]) => v === field)?.[0];
    return col ? row[col]?.trim() : undefined;
  };

  // Process each row
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2;

    try {
      // 1. Get or create company
      const companyName = getField(row, 'company_name');
      if (!companyName) {
        errors.push({ row: rowNum, message: 'Missing company name' });
        continue;
      }

      let companyId = companyIdMap.get(companyName.toLowerCase().trim());

      if (!companyId) {
        // Create new company
        const companyData: Record<string, unknown> = {
          name: companyName,
          status: getField(row, 'company_status') || 'cold_lead',
        };

        const segment = getField(row, 'company_segment');
        companyData.segment = segment || 'smb';

        const industry = getField(row, 'company_industry');
        companyData.industry = industry || 'pest';

        const agentCount = getField(row, 'company_agent_count');
        if (agentCount) companyData.agent_count = parseInt(agentCount) || null;

        const crm = getField(row, 'company_crm');
        if (crm) companyData.crm_platform = crm;

        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert(companyData)
          .select('id')
          .single();

        if (companyError) {
          errors.push({ row: rowNum, message: `Company error: ${companyError.message}` });
          continue;
        }

        companyId = newCompany.id as string;
        companyIdMap.set(companyName.toLowerCase().trim(), companyId);
        results.companies++;

        onProgress({
          phase: 'companies',
          current: i + 1,
          total: rawData.length,
          action: `Created company: ${companyName}`,
        });
      }

      // 2. Create contact if data exists
      const contactName = getField(row, 'contact_name');
      const contactEmail = getField(row, 'contact_email');

      if (contactName || contactEmail) {
        const contactData: Record<string, unknown> = {
          company_id: companyId,
          name: contactName || 'Unknown',
          email: contactEmail || null,
          phone: cleanPhoneNumber(getField(row, 'contact_phone')) || null,
          title: getField(row, 'contact_title') || null,
          role: getField(row, 'contact_role') || null,
          is_primary: parseBoolean(getField(row, 'contact_is_primary')),
        };

        const { error: contactError } = await supabase.from('contacts').insert(contactData);

        if (contactError) {
          errors.push({ row: rowNum, message: `Contact error: ${contactError.message}` });
        } else {
          results.contacts++;
          onProgress({
            phase: 'contacts',
            current: i + 1,
            total: rawData.length,
            action: `Created contact: ${contactName || contactEmail}`,
          });
        }
      }

      // 3. Create deal if data exists
      const dealName = getField(row, 'deal_name');
      const dealValue = getField(row, 'deal_value');
      const stageCol = Object.entries(columnMapping).find(([, v]) => v === 'deal_stage')?.[0];
      const rawStage = stageCol ? row[stageCol]?.trim() : undefined;
      const ownerCol = Object.entries(columnMapping).find(([, v]) => v === 'deal_owner')?.[0];
      const rawOwner = ownerCol ? row[ownerCol]?.trim() : undefined;

      if (dealName || dealValue || rawStage) {
        // Determine owner
        let ownerId = currentUserId;
        if (rawOwner && ownerMapping[rawOwner] && ownerMapping[rawOwner] !== '_unassigned') {
          ownerId = ownerMapping[rawOwner];
        } else if (ownerMapping._default) {
          ownerId = ownerMapping._default;
        }

        // Determine stage
        const stage = rawStage
          ? stageMapping[rawStage] || stageMapping._default || 'new_lead'
          : 'new_lead';

        const dealData: Record<string, unknown> = {
          name: dealName || companyName,
          company_id: companyId,
          owner_id: ownerId,
          stage,
          estimated_value: cleanCurrencyValue(dealValue) || 0,
        };

        const dealType = getField(row, 'deal_type');
        if (dealType) dealData.deal_type = dealType;

        const salesTeam = getField(row, 'deal_sales_team');
        if (salesTeam) dealData.sales_team = salesTeam;

        const closeDate = parseDate(getField(row, 'deal_close_date'));
        if (closeDate) dealData.expected_close_date = closeDate;

        const { error: dealError } = await supabase.from('deals').insert(dealData);

        if (dealError) {
          errors.push({ row: rowNum, message: `Deal error: ${dealError.message}` });
        } else {
          results.deals++;
          onProgress({
            phase: 'deals',
            current: i + 1,
            total: rawData.length,
            action: `Created deal: ${dealName || companyName}`,
          });
        }
      }

      // 4. Create activity if data exists
      const activityNote = getField(row, 'activity_note');
      if (activityNote) {
        const activityData = {
          company_id: companyId,
          user_id: currentUserId,
          type: 'note' as const,
          body: activityNote,
          occurred_at: parseDate(getField(row, 'activity_date')) || new Date().toISOString(),
        };

        const { error: activityError } = await supabase.from('activities').insert(activityData);

        if (activityError) {
          errors.push({ row: rowNum, message: `Activity error: ${activityError.message}` });
        } else {
          results.activities++;
          onProgress({
            phase: 'activities',
            current: i + 1,
            total: rawData.length,
            action: `Created activity note`,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: rowNum, message: msg });
    }
  }

  return { results, errors };
}
