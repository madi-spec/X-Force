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

  // Get user profile to get internal user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL('/settings/integrations?error=user_not_found', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }

  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'Mail.Read',
    'Mail.Send',
    'Mail.ReadWrite',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Files.Read',
    'User.Read',
  ].join(' ');

  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/auth/microsoft/callback';

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    response_mode: 'query',
    state: profile.id, // Pass user ID through state
    prompt: 'consent', // Force consent screen to ensure we get refresh token
  });

  return NextResponse.redirect(`${MICROSOFT_AUTH_URL}?${params}`);
}
