import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/microsoft/sendEmail';
import { hasActiveConnection } from '@/lib/microsoft/auth';

/**
 * Send an email via Microsoft 365
 * POST /api/microsoft/send
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Check if user has active Microsoft connection
  const isConnected = await hasActiveConnection(profile.id);
  if (!isConnected) {
    return NextResponse.json(
      { error: 'No active Microsoft connection' },
      { status: 400 }
    );
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { to, subject, content, cc, contactId, dealId, isHtml } = body;

  // Validate required fields
  if (!to || !Array.isArray(to) || to.length === 0) {
    return NextResponse.json(
      { error: 'At least one recipient is required' },
      { status: 400 }
    );
  }

  if (!subject) {
    return NextResponse.json(
      { error: 'Subject is required' },
      { status: 400 }
    );
  }

  if (!content) {
    return NextResponse.json(
      { error: 'Email content is required' },
      { status: 400 }
    );
  }

  // Send the email
  const result = await sendEmail(profile.id, to, subject, content, cc, isHtml);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to send email' },
      { status: 500 }
    );
  }

  // Log the activity if contact/deal provided
  if (contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .eq('id', contactId)
      .single();

    if (contact) {
      await supabase.from('activities').insert({
        type: 'email',
        subject,
        description: content.substring(0, 500), // Truncate for description
        contact_id: contact.id,
        company_id: contact.company_id,
        deal_id: dealId || null,
        created_by: profile.id,
        completed_at: new Date().toISOString(),
        metadata: {
          direction: 'outbound',
          to,
          cc,
          sent_via: 'microsoft',
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
