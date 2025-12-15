import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function completeReviewTasks() {
  // Get all pending review tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description')
    .eq('source', 'fireflies_ai')
    .is('completed_at', null);

  console.log(`Found ${tasks?.length || 0} pending review tasks\n`);

  for (const task of tasks || []) {
    console.log('=== ' + task.title + ' ===');

    // Extract transcription ID
    const match = task.description?.match(/Transcription ID:\s*([a-f0-9-]+)/i);
    const transcriptionId = match ? match[1] : null;

    if (!transcriptionId) {
      console.log('No transcription ID, skipping\n');
      continue;
    }

    // Get transcript with extracted data
    const { data: transcript } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, external_metadata')
      .eq('id', transcriptionId)
      .single();

    const extracted = transcript?.external_metadata?.extracted_entity_data;
    console.log('Transcript:', transcript?.title);
    console.log('Extracted company:', extracted?.company?.name);

    if (!extracted?.company?.name) {
      console.log('No extracted data, skipping\n');
      continue;
    }

    // Find similar company by name
    const searchTerms = extracted.company.name.toLowerCase().split(/\s+/);
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, status')
      .limit(500);

    const similar = (companies || [])
      .map(c => {
        const nameLower = c.name.toLowerCase();
        const score = searchTerms.filter(term =>
          nameLower.includes(term) || term.includes(nameLower.split(/\s+/)[0])
        ).length;
        return { ...c, score };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    let companyId = null;
    let companyName = null;
    let action = '';

    if (similar.length > 0 && similar[0].score >= 1) {
      // Match to best similar company
      companyId = similar[0].id;
      companyName = similar[0].name;
      action = 'Matched to existing';
      console.log('Matching to:', companyName);
    } else {
      // Create new company
      console.log('Creating new company:', extracted.company.name);

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: extracted.company.name,
          status: 'prospect',
          segment: extracted.company.segment || 'smb',
          industry: extracted.company.industry || 'pest',
          agent_count: extracted.company.estimatedAgentCount || 1,
          crm_platform: extracted.company.crmPlatform || null,
        })
        .select('id, name')
        .single();

      if (companyError) {
        console.log('Error creating company:', companyError.message);
        continue;
      }

      companyId = newCompany.id;
      companyName = newCompany.name;
      action = 'Created new company';

      // Create contacts
      if (extracted.contacts?.length > 0) {
        for (const contact of extracted.contacts) {
          if (contact.name) {
            await supabase.from('contacts').insert({
              company_id: companyId,
              name: contact.name,
              email: contact.email || '',
              title: contact.title || null,
              role: contact.role || null,
              is_primary: contact.isPrimary || false,
            });
          }
        }
        console.log('Created', extracted.contacts.length, 'contacts');
      }

      // Create deal
      if (extracted.deal) {
        // Get user_id from task
        const { data: taskData } = await supabase
          .from('tasks')
          .select('assigned_to')
          .eq('id', task.id)
          .single();

        const { data: newDeal, error: dealError } = await supabase
          .from('deals')
          .insert({
            company_id: companyId,
            owner_id: taskData?.assigned_to,
            name: extracted.deal.suggestedName || extracted.company.name,
            stage: 'new_lead',
            deal_type: 'new_business',
            sales_team: extracted.deal.salesTeam || 'voice_inside',
            estimated_value: extracted.deal.estimatedValue || 10000,
            quoted_products: extracted.deal.productInterests || [],
          })
          .select('id, name')
          .single();

        if (!dealError && newDeal) {
          console.log('Created deal:', newDeal.name);

          // Update transcript with deal
          await supabase
            .from('meeting_transcriptions')
            .update({ deal_id: newDeal.id })
            .eq('id', transcriptionId);
        }
      }
    }

    // Update transcript with company
    const { error: updateError } = await supabase
      .from('meeting_transcriptions')
      .update({
        company_id: companyId,
        match_confidence: 1.0,
      })
      .eq('id', transcriptionId);

    if (updateError) {
      console.log('Error updating transcript:', updateError.message);
      continue;
    }

    // Complete the task
    await supabase
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', task.id);

    console.log('✓', action + ':', companyName);
    console.log('');
  }

  console.log('=== Done ===');
}

completeReviewTasks().catch(console.error);
