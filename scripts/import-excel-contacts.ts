import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExcelRow {
  matched_customer: string;
  matched_customer_rev_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  email_domain: string;
  'Estimated Agents': string;
}

function parseAgentCount(estimatedAgents: string | null): number | null {
  if (!estimatedAgents) return null;

  // Handle formats like ">26 Agents", "11 - 15 Agents", "1 - 5 Agents"
  const str = estimatedAgents.toString().toLowerCase();

  if (str.startsWith('>')) {
    // ">26 Agents" -> 26
    const match = str.match(/>\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  if (str.includes('-')) {
    // "11 - 15 Agents" -> take the higher number (15)
    const match = str.match(/(\d+)\s*-\s*(\d+)/);
    return match ? parseInt(match[2], 10) : null;
  }

  // Try to extract any number
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  const filePath = path.join(process.cwd(), 'docs', 'linked_contacts_to_customers_with_ATS_or_Rev_and_revenue.xlsx');
  console.log('Reading Excel file:', filePath);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Matches'];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  console.log(`\nFound ${rows.length} rows to process\n`);

  // Stats
  let companiesFound = 0;
  let companiesNotFound = 0;
  let companiesUpdated = 0;
  let contactsCreated = 0;
  let contactsSkipped = 0;
  let errors = 0;

  const notFoundCompanies: { name: string; revId: number }[] = [];

  for (const row of rows) {
    const revId = String(row.matched_customer_rev_id);

    // Find company by vfp_customer_id (Rev ID)
    const { data: company, error: findError } = await supabase
      .from('companies')
      .select('id, name, domain, agent_count')
      .eq('vfp_customer_id', revId)
      .single();

    if (findError || !company) {
      companiesNotFound++;
      notFoundCompanies.push({ name: row.matched_customer, revId: row.matched_customer_rev_id });
      continue;
    }

    companiesFound++;

    // Prepare company updates
    const companyUpdates: Record<string, unknown> = {};

    // Update domain if not already set
    if (row.email_domain && !company.domain) {
      companyUpdates.domain = row.email_domain;
    }

    // Update agent_count from estimated agents
    const agentCount = parseAgentCount(row['Estimated Agents']);
    if (agentCount !== null && (!company.agent_count || company.agent_count === 0)) {
      companyUpdates.agent_count = agentCount;
    }

    // Update company if there are changes
    if (Object.keys(companyUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyUpdates)
        .eq('id', company.id);

      if (updateError) {
        console.error(`Error updating company ${company.name}:`, updateError.message);
        errors++;
      } else {
        companiesUpdated++;
      }
    }

    // Check if contact already exists
    if (row.contact_email) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', company.id)
        .eq('email', row.contact_email.toLowerCase())
        .single();

      if (existingContact) {
        contactsSkipped++;
        continue;
      }

      // Create contact
      const contactData = {
        company_id: company.id,
        name: row.contact_name || 'Unknown',
        email: row.contact_email.toLowerCase(),
        phone: row.contact_phone || null,
        role: null,
        is_primary: false,
      };

      const { error: contactError } = await supabase
        .from('contacts')
        .insert(contactData);

      if (contactError) {
        console.error(`Error creating contact for ${company.name}:`, contactError.message);
        errors++;
      } else {
        contactsCreated++;
      }
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total rows processed: ${rows.length}`);
  console.log(`Companies found: ${companiesFound}`);
  console.log(`Companies not found: ${companiesNotFound}`);
  console.log(`Companies updated: ${companiesUpdated}`);
  console.log(`Contacts created: ${contactsCreated}`);
  console.log(`Contacts skipped (already exist): ${contactsSkipped}`);
  console.log(`Errors: ${errors}`);

  if (notFoundCompanies.length > 0 && notFoundCompanies.length <= 20) {
    console.log('\nCompanies not found in database:');
    notFoundCompanies.forEach(c => console.log(`  - ${c.name} (Rev ID: ${c.revId})`));
  } else if (notFoundCompanies.length > 20) {
    console.log(`\nFirst 20 companies not found in database:`);
    notFoundCompanies.slice(0, 20).forEach(c => console.log(`  - ${c.name} (Rev ID: ${c.revId})`));
    console.log(`  ... and ${notFoundCompanies.length - 20} more`);
  }
}

main().catch(console.error);
