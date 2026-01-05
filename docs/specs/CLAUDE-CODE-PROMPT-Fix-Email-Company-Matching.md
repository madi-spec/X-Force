# Fix Email-to-Company Matching

## The Problem

Emails are showing as "Unlinked" in the Communications Hub even when:
- The sender (e.g., ramzey@happinest.com) exists as a contact
- The contact is linked to a company (Happinest)
- The company exists in the system

**Root Cause:** When emails are synced to the `communications` table, they're not being matched to companies/contacts.

## The Solution

Create a matching function that:
1. Extracts sender email from the communication
2. Looks up contact by email
3. Gets company_id from contact (or from email domain)
4. Updates the communication with company_id and contact_id

---

## Tasks

### Task 1: Create Email Matching Utility

Create `src/lib/communicationHub/matching/matchEmailToCompany.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

interface MatchResult {
  company_id: string | null;
  contact_id: string | null;
  matched_by: 'contact_email' | 'company_domain' | 'contact_domain' | null;
}

/**
 * Match an email address to a company and contact
 */
export async function matchEmailToCompany(email: string): Promise<MatchResult> {
  if (!email) {
    return { company_id: null, contact_id: null, matched_by: null };
  }
  
  const supabase = createAdminClient();
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];
  
  // Strategy 1: Direct contact email match
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id, email')
    .ilike('email', emailLower)
    .single();
  
  if (contact?.company_id) {
    console.log(`[EmailMatch] Matched ${email} to contact ${contact.id}, company ${contact.company_id}`);
    return {
      company_id: contact.company_id,
      contact_id: contact.id,
      matched_by: 'contact_email',
    };
  }
  
  // Strategy 2: Match company domain
  if (domain) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, domain')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .single();
    
    if (company) {
      console.log(`[EmailMatch] Matched ${email} to company ${company.id} via domain`);
      return {
        company_id: company.id,
        contact_id: contact?.id || null,
        matched_by: 'company_domain',
      };
    }
  }
  
  // Strategy 3: Match any contact with same email domain
  if (domain) {
    const { data: domainContact } = await supabase
      .from('contacts')
      .select('id, company_id, email')
      .ilike('email', `%@${domain}`)
      .not('company_id', 'is', null)
      .limit(1)
      .single();
    
    if (domainContact?.company_id) {
      console.log(`[EmailMatch] Matched ${email} to company ${domainContact.company_id} via contact domain`);
      return {
        company_id: domainContact.company_id,
        contact_id: null, // Don't assign to a different contact
        matched_by: 'contact_domain',
      };
    }
  }
  
  console.log(`[EmailMatch] No match found for ${email}`);
  return { company_id: null, contact_id: null, matched_by: null };
}

/**
 * Match a communication to company/contact based on participants
 */
export async function matchCommunicationToCompany(communicationId: string): Promise<MatchResult> {
  const supabase = createAdminClient();
  
  // Get the communication
  const { data: comm, error } = await supabase
    .from('communications')
    .select('id, direction, their_participants, our_participants, company_id, contact_id')
    .eq('id', communicationId)
    .single();
  
  if (error || !comm) {
    console.error(`[EmailMatch] Communication not found: ${communicationId}`);
    return { company_id: null, contact_id: null, matched_by: null };
  }
  
  // Already linked? Skip
  if (comm.company_id) {
    return { company_id: comm.company_id, contact_id: comm.contact_id, matched_by: null };
  }
  
  // Get email from their_participants (the external party)
  const theirParticipants = comm.their_participants as any[] || [];
  const externalEmail = theirParticipants[0]?.email;
  
  if (!externalEmail) {
    console.log(`[EmailMatch] No external email in communication ${communicationId}`);
    return { company_id: null, contact_id: null, matched_by: null };
  }
  
  // Match the email
  const match = await matchEmailToCompany(externalEmail);
  
  // Update the communication if matched
  if (match.company_id) {
    const updates: any = { company_id: match.company_id };
    if (match.contact_id) {
      updates.contact_id = match.contact_id;
    }
    
    await supabase
      .from('communications')
      .update(updates)
      .eq('id', communicationId);
    
    console.log(`[EmailMatch] Updated communication ${communicationId} with company ${match.company_id}`);
  }
  
  return match;
}
```

### Task 2: Create Batch Matching Script

Create `scripts/match-emails-to-companies.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function matchEmailToCompany(email: string) {
  if (!email) return { company_id: null, contact_id: null };
  
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];
  
  // Strategy 1: Direct contact email match
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id, email')
    .ilike('email', emailLower)
    .single();
  
  if (contact?.company_id) {
    return { company_id: contact.company_id, contact_id: contact.id, matched_by: 'contact_email' };
  }
  
  // Strategy 2: Match company domain
  if (domain) {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .single();
    
    if (company) {
      return { company_id: company.id, contact_id: contact?.id || null, matched_by: 'company_domain' };
    }
  }
  
  // Strategy 3: Match contact with same domain
  if (domain) {
    const { data: domainContact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .ilike('email', `%@${domain}`)
      .not('company_id', 'is', null)
      .limit(1)
      .single();
    
    if (domainContact?.company_id) {
      return { company_id: domainContact.company_id, contact_id: null, matched_by: 'contact_domain' };
    }
  }
  
  return { company_id: null, contact_id: null, matched_by: null };
}

async function main() {
  console.log('Finding unlinked communications...\n');
  
  // Get all communications without company_id
  const { data: unlinked, error } = await supabase
    .from('communications')
    .select('id, their_participants, subject')
    .is('company_id', null)
    .eq('channel', 'email');
  
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  console.log(`Found ${unlinked?.length || 0} unlinked email communications\n`);
  
  let matched = 0;
  let notMatched = 0;
  const notMatchedEmails: string[] = [];
  
  for (const comm of unlinked || []) {
    const participants = comm.their_participants as any[] || [];
    const email = participants[0]?.email;
    
    if (!email) {
      console.log(`  [${comm.id}] No email in participants`);
      notMatched++;
      continue;
    }
    
    const match = await matchEmailToCompany(email);
    
    if (match.company_id) {
      // Update the communication
      const updates: any = { company_id: match.company_id };
      if (match.contact_id) updates.contact_id = match.contact_id;
      
      await supabase
        .from('communications')
        .update(updates)
        .eq('id', comm.id);
      
      console.log(`  ✓ ${email} → company ${match.company_id} (${match.matched_by})`);
      matched++;
    } else {
      console.log(`  ✗ ${email} → no match found`);
      notMatched++;
      if (!notMatchedEmails.includes(email)) {
        notMatchedEmails.push(email);
      }
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Matched: ${matched}`);
  console.log(`Not matched: ${notMatched}`);
  
  if (notMatchedEmails.length > 0) {
    console.log('\nUnmatched emails (may need to create contacts):');
    notMatchedEmails.forEach(e => console.log(`  - ${e}`));
  }
}

main().catch(console.error);
```

### Task 3: Update Email Sync to Include Matching

Update `src/lib/communicationHub/sync/syncEmail.ts` to match after insert:

Find the section after the communication is inserted and add:

```typescript
// After inserting the communication, try to match to company
import { matchCommunicationToCompany } from '../matching/matchEmailToCompany';

// ... after insert ...

// Try to match to company if not already linked
if (!communication.company_id) {
  await matchCommunicationToCompany(inserted.id);
}
```

### Task 4: Run the Matching Script

```bash
npx ts-node scripts/match-emails-to-companies.ts
```

### Task 5: Check for Missing Contacts

If emails still don't match, we may need to create contacts. Check if contacts exist for the email domains:

```sql
-- Check which domains have contacts
SELECT DISTINCT 
  SPLIT_PART(email, '@', 2) as domain,
  COUNT(*) as contact_count
FROM contacts
WHERE email IS NOT NULL
GROUP BY domain
ORDER BY domain;

-- Check which companies have domains set
SELECT id, name, domain, website 
FROM companies 
WHERE domain IS NOT NULL OR website IS NOT NULL;
```

### Task 6: Verify Results

After running the script:

```sql
-- Check how many are now linked
SELECT 
  CASE WHEN company_id IS NOT NULL THEN 'linked' ELSE 'unlinked' END as status,
  COUNT(*) 
FROM communications 
WHERE channel = 'email'
GROUP BY status;

-- Check Ramzey specifically
SELECT c.id, c.subject, c.their_participants, c.company_id, co.name as company_name
FROM communications c
LEFT JOIN companies co ON c.company_id = co.id
WHERE c.their_participants::text ILIKE '%ramz%'
   OR c.their_participants::text ILIKE '%happinest%';
```

---

## Success Criteria

- [ ] matchEmailToCompany function created
- [ ] Matching script ran successfully
- [ ] Ramzey's emails are now linked to Happinest
- [ ] Most emails are now linked (check unlinked count decreased)
- [ ] New emails will auto-match via updated sync

---

## If Emails Still Don't Match

The matching depends on having:
1. **Contacts with emails** - `contacts` table needs email addresses
2. **Contacts linked to companies** - `contacts.company_id` must be set
3. **OR Company domains** - `companies.domain` or `companies.website` set

If Ramzey doesn't match, check:
```sql
-- Does Ramzey exist as a contact?
SELECT * FROM contacts WHERE email ILIKE '%ramz%' OR email ILIKE '%happinest%';

-- Does Happinest have a domain set?
SELECT * FROM companies WHERE name ILIKE '%happinest%';
```

If contact doesn't exist or isn't linked, you may need to create/update them.
