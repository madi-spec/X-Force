import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

/**
 * Initiates the Microsoft OAuth flow
 * GET /api/auth/microsoft
 */
export async function GET() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }

  // Get user profile to get internal user ID and email
  const { data: profile } = await supabase
    .from('users')
    .select('id, email')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL('/settings/integrations?error=user_not_found', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }

  // Get the user's Microsoft email (might be different from Supabase email)
  // For now, use their profile email as the expected Microsoft account
  const expectedEmail = profile.email || user.email;

  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'Mail.Read',
    'Mail.Send',
    'Mail.ReadWrite',
    'MailboxSettings.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Files.Read',
    'User.Read',
    'User.ReadBasic.All',
  ].join(' ');

  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/auth/microsoft/callback';

  // Encode user ID and expected email in state for validation in callback
  const stateData = JSON.stringify({ userId: profile.id, expectedEmail });
  const encodedState = Buffer.from(stateData).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    response_mode: 'query',
    state: encodedState,
    prompt: 'select_account', // Let user choose account, only show consent if not already granted
    login_hint: expectedEmail || '', // Pre-fill the user's email in Microsoft sign-in
  });

  return NextResponse.redirect(`${MICROSOFT_AUTH_URL}?${params}`);
}
