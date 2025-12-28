/**
 * Create Lead from Communication
 *
 * Creates a new company and contact from an unlinked communication,
 * then links the communication to the newly created records.
 *
 * Supports both:
 * - communications.id (from Communication Hub)
 * - email_messages.id (from Inbox - will find corresponding communication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractEmailsFromBody, getExternalEmails } from '@/lib/communicationHub/matching/matchEmailToCompany';

interface CreateLeadRequest {
  email?: string; // Specific email to use (optional - will auto-detect if not provided)
  companyName?: string; // Override company name (optional - will derive from domain)
  contactName?: string; // Contact name (optional)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communicationId } = await params;
    const body: CreateLeadRequest = await request.json();

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Try to get the communication directly
    let comm = null;

    // First try as communication ID
    const { data: directComm } = await adminClient
      .from('communications')
      .select('id, company_id, contact_id, their_participants, our_participants, full_content, content_preview, subject')
      .eq('id', communicationId)
      .single();

    if (directComm) {
      comm = directComm;
    } else {
      // Try as email_messages ID - find corresponding communication
      const { data: commBySource } = await adminClient
        .from('communications')
        .select('id, company_id, contact_id, their_participants, our_participants, full_content, content_preview, subject')
        .eq('source_table', 'email_messages')
        .eq('source_id', communicationId)
        .single();

      if (commBySource) {
        comm = commBySource;
      } else {
        // If still not found, try to get the email_message directly and use its data
        const { data: emailMsg } = await adminClient
          .from('email_messages')
          .select('id, from_email, from_name, to_emails, to_names, body_text, body_html, body_preview, subject')
          .eq('id', communicationId)
          .single();

        if (emailMsg) {
          // Build a pseudo-communication object from the email message
          const fromParticipant = { email: emailMsg.from_email, name: emailMsg.from_name };
          const toParticipants = (emailMsg.to_emails || []).map((email: string, i: number) => ({
            email,
            name: emailMsg.to_names?.[i] || ''
          }));

          comm = {
            id: emailMsg.id, // Use email_message id
            company_id: null,
            contact_id: null,
            their_participants: [fromParticipant],
            our_participants: toParticipants,
            full_content: emailMsg.body_text || emailMsg.body_html || emailMsg.body_preview,
            content_preview: emailMsg.body_preview,
            subject: emailMsg.subject,
            _isEmailMessage: true // Flag to indicate this is from email_messages
          };
        }
      }
    }

    if (!comm) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    // Already linked?
    if (comm.company_id) {
      return NextResponse.json({
        error: 'Communication is already linked to a company',
        company_id: comm.company_id
      }, { status: 400 });
    }

    // Collect all possible emails
    const theirParticipants = (comm.their_participants as Array<{ email?: string; name?: string }>) || [];
    const ourParticipants = (comm.our_participants as Array<{ email?: string; name?: string }>) || [];

    const theirEmails = theirParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
    const ourEmails = ourParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];

    // Get external emails from participants
    const externalParticipantEmails = getExternalEmails([...theirEmails, ...ourEmails]);

    // Also check body for emails
    const content = comm.full_content || comm.content_preview || '';
    const bodyEmails = extractEmailsFromBody(content);

    // Combine all external emails
    const allExternalEmails = [...new Set([...externalParticipantEmails, ...bodyEmails])];

    if (allExternalEmails.length === 0) {
      return NextResponse.json({
        error: 'No external email addresses found in this communication'
      }, { status: 400 });
    }

    // Determine which email to use
    let selectedEmail = body.email?.toLowerCase();
    if (!selectedEmail) {
      // Use first external email by default
      selectedEmail = allExternalEmails[0];
    } else if (!allExternalEmails.includes(selectedEmail)) {
      return NextResponse.json({
        error: 'Selected email not found in communication',
        available_emails: allExternalEmails
      }, { status: 400 });
    }

    const domain = selectedEmail.split('@')[1];

    // Check if company with this domain already exists
    const { data: existingCompany } = await adminClient
      .from('companies')
      .select('id, name')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .single();

    if (existingCompany) {
      // Link to existing company instead of creating new
      await adminClient
        .from('communications')
        .update({ company_id: existingCompany.id })
        .eq('id', communicationId);

      return NextResponse.json({
        success: true,
        action: 'linked_existing',
        company: { id: existingCompany.id, name: existingCompany.name },
        message: `Linked to existing company: ${existingCompany.name}`
      });
    }

    // Check if contact with this email already exists
    const { data: existingContact } = await adminClient
      .from('contacts')
      .select('id, name, email, company_id')
      .ilike('email', selectedEmail)
      .single();

    if (existingContact) {
      // Link to existing contact's company if they have one
      if (existingContact.company_id) {
        await adminClient
          .from('communications')
          .update({
            company_id: existingContact.company_id,
            contact_id: existingContact.id
          })
          .eq('id', communicationId);

        return NextResponse.json({
          success: true,
          action: 'linked_existing_contact',
          contact: { id: existingContact.id, name: existingContact.name },
          message: `Linked to existing contact: ${existingContact.name}`
        });
      }
    }

    // Create new company
    const companyName = body.companyName || formatCompanyName(domain);

    const { data: newCompany, error: companyError } = await adminClient
      .from('companies')
      .insert({
        name: companyName,
        domain: domain,
        website: `https://${domain}`,
        status: 'lead',
        source: 'email_import',
        created_by: user.id,
      })
      .select('id, name')
      .single();

    if (companyError) {
      console.error('[CreateLead] Error creating company:', companyError);
      return NextResponse.json({
        error: 'Failed to create company',
        details: companyError.message
      }, { status: 500 });
    }

    // Try to find a name from the participant
    let contactName = body.contactName;
    if (!contactName) {
      const participant = [...theirParticipants, ...ourParticipants].find(
        p => p.email?.toLowerCase() === selectedEmail
      );
      contactName = participant?.name || selectedEmail.split('@')[0];
    }

    // Create contact
    const { data: newContact, error: contactError } = await adminClient
      .from('contacts')
      .insert({
        name: contactName,
        email: selectedEmail,
        company_id: newCompany.id,
        source: 'email_import',
        created_by: user.id,
      })
      .select('id, name')
      .single();

    if (contactError) {
      console.error('[CreateLead] Error creating contact:', contactError);
      // Still link to company even if contact creation fails
    }

    // Link communication to new company and contact
    const updates: Record<string, string | null> = { company_id: newCompany.id };
    if (newContact) {
      updates.contact_id = newContact.id;
    }

    // Update the communication (if it exists)
    await adminClient
      .from('communications')
      .update(updates)
      .eq('id', comm.id);

    // If this was from an email_message, also update the email_conversation
    if ((comm as { _isEmailMessage?: boolean })._isEmailMessage) {
      // Find the email_conversation for this message
      const { data: emailMsg } = await adminClient
        .from('email_messages')
        .select('conversation_ref')
        .eq('id', communicationId)
        .single();

      if (emailMsg?.conversation_ref) {
        await adminClient
          .from('email_conversations')
          .update({ company_id: newCompany.id, contact_id: newContact?.id || null })
          .eq('id', emailMsg.conversation_ref);
      }
    }

    // Also link any other communications with the same email
    const { data: linkedData } = await adminClient
      .from('communications')
      .update({ company_id: newCompany.id, contact_id: newContact?.id || null })
      .is('company_id', null)
      .or(`their_participants.cs.[{"email":"${selectedEmail}"}],our_participants.cs.[{"email":"${selectedEmail}"}]`)
      .select('id');

    const linkedCount = linkedData?.length || 0;

    // Also update related email_conversations
    await adminClient
      .from('email_conversations')
      .update({ company_id: newCompany.id, contact_id: newContact?.id || null })
      .is('company_id', null)
      .contains('participant_emails', [selectedEmail]);

    return NextResponse.json({
      success: true,
      action: 'created',
      company: { id: newCompany.id, name: newCompany.name },
      contact: newContact ? { id: newContact.id, name: newContact.name } : null,
      additional_linked: linkedCount || 0,
      message: `Created new lead: ${companyName}`
    });

  } catch (error) {
    console.error('[CreateLead] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 });
  }
}

/**
 * GET - Get available emails for creating a lead from this communication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communicationId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: comm, error } = await adminClient
      .from('communications')
      .select('id, company_id, their_participants, our_participants, full_content, content_preview')
      .eq('id', communicationId)
      .single();

    if (error || !comm) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    if (comm.company_id) {
      return NextResponse.json({
        linked: true,
        company_id: comm.company_id,
        available_emails: []
      });
    }

    // Collect all possible emails
    const theirParticipants = (comm.their_participants as Array<{ email?: string; name?: string }>) || [];
    const ourParticipants = (comm.our_participants as Array<{ email?: string; name?: string }>) || [];

    const theirEmails = theirParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
    const ourEmails = ourParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];

    const externalParticipantEmails = getExternalEmails([...theirEmails, ...ourEmails]);

    const content = comm.full_content || comm.content_preview || '';
    const bodyEmails = extractEmailsFromBody(content);

    // Build email options with source info
    const emailOptions: Array<{
      email: string;
      name?: string;
      domain: string;
      suggestedCompanyName: string;
      source: 'participant' | 'body';
    }> = [];

    for (const email of externalParticipantEmails) {
      const participant = [...theirParticipants, ...ourParticipants].find(
        p => p.email?.toLowerCase() === email
      );
      const domain = email.split('@')[1];
      emailOptions.push({
        email,
        name: participant?.name,
        domain,
        suggestedCompanyName: formatCompanyName(domain),
        source: 'participant'
      });
    }

    for (const email of bodyEmails) {
      if (!externalParticipantEmails.includes(email)) {
        const domain = email.split('@')[1];
        emailOptions.push({
          email,
          domain,
          suggestedCompanyName: formatCompanyName(domain),
          source: 'body'
        });
      }
    }

    return NextResponse.json({
      linked: false,
      available_emails: emailOptions
    });

  } catch (error) {
    console.error('[CreateLead] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Format domain into a readable company name
 */
function formatCompanyName(domain: string): string {
  // Remove common TLDs and format
  const name = domain
    .replace(/\.(com|net|org|io|co|us|biz|info)$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return name;
}
