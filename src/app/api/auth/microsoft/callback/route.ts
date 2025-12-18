import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_URL = 'https://graph.microsoft.com/v1.0';

/**
 * Handles the Microsoft OAuth callback
 * GET /api/auth/microsoft/callback
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user ID
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?error=missing_params`
    );
  }

  // Decode state to get user ID and expected email
  let stateData: { userId: string; expectedEmail?: string };
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    stateData = JSON.parse(decoded);
  } catch {
    // Fallback for old-style state (just user ID)
    stateData = { userId: state };
  }

  const { userId, expectedEmail } = stateData;

  try {
    // Exchange code for tokens
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/auth/microsoft/callback';

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Token exchange failed:', tokens.error_description);
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=${encodeURIComponent(tokens.error)}`
      );
    }

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch(`${GRAPH_URL}/me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const profile = await profileResponse.json();

    if (profile.error) {
      console.error('Failed to get Microsoft profile:', profile.error);
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=profile_fetch_failed`
      );
    }

    const microsoftEmail = (profile.mail || profile.userPrincipalName || '').toLowerCase();

    // Validate that the signed-in Microsoft account matches the expected user
    if (expectedEmail) {
      const expectedLower = expectedEmail.toLowerCase();
      if (microsoftEmail !== expectedLower) {
        console.log(
          `Admin consent flow detected: expected ${expectedEmail}, got ${microsoftEmail}`
        );
        // Admin granted consent - redirect user to try again
        // The consent should now be cached at the tenant level
        return NextResponse.redirect(
          `${baseUrl}/settings/integrations?admin_consent_granted=true&message=${encodeURIComponent('Admin consent granted! Please click Connect again to link your account.')}`
        );
      }
    }

    // Store connection in database (use admin client to bypass RLS)
    const supabase = createAdminClient();

    const { error: upsertError } = await supabase
      .from('microsoft_connections')
      .upsert({
        user_id: userId,
        microsoft_user_id: profile.id,
        email: microsoftEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: tokens.scope?.split(' ') || [],
        connected_at: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('Failed to save connection:', JSON.stringify(upsertError, null, 2));
      console.error('User ID:', userId);
      console.error('Data being saved:', {
        user_id: userId,
        microsoft_user_id: profile.id,
        email: microsoftEmail,
      });
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=save_failed&details=${encodeURIComponent(upsertError.message || 'unknown')}`
      );
    }

    // Success - redirect to integrations page
    return NextResponse.redirect(`${baseUrl}/settings/integrations?success=microsoft`);

  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?error=unexpected_error`
    );
  }
}
