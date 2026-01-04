import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/login?error=auth_failed&message=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    console.error('Missing code parameter');
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`);
  }

  try {
    const cookieStore = await cookies();

    // Create Supabase client with proper cookie handling for Route Handlers
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Exchange code for session
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Session exchange failed:', exchangeError.message);
      return NextResponse.redirect(
        `${baseUrl}/login?error=auth_failed&message=${encodeURIComponent(exchangeError.message)}`
      );
    }

    if (!sessionData.session) {
      console.error('No session returned from exchange');
      return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
    }

    const { session, user } = sessionData;
    const userEmail = user.email?.toLowerCase();

    if (!userEmail) {
      console.error('No email in user object');
      return NextResponse.redirect(`${baseUrl}/login?error=no_email`);
    }

    console.log('User authenticated:', userEmail);

    // Use admin client to bypass RLS for user lookup
    const adminClient = createAdminClient();

    // Validate user exists in users table (case-insensitive email match)
    const { data: existingUser, error: userError } = await adminClient
      .from('users')
      .select('id, email, is_active, auth_id')
      .ilike('email', userEmail)
      .single();

    if (userError || !existingUser) {
      // User not found - not registered
      console.log('User not found in users table:', userEmail);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${baseUrl}/login?error=not_registered`);
    }

    // Check if user is active
    if (!existingUser.is_active) {
      console.log('User account deactivated:', userEmail);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${baseUrl}/login?error=account_deactivated`);
    }

    // Link auth_id if not already linked
    if (!existingUser.auth_id || existingUser.auth_id !== user.id) {
      console.log('Linking auth_id for user:', existingUser.id);
      const { error: linkError } = await adminClient
        .from('users')
        .update({ auth_id: user.id })
        .eq('id', existingUser.id);

      if (linkError) {
        console.error('Failed to link auth_id:', linkError);
        // Continue anyway - non-critical
      }
    }

    // Extract provider tokens from session
    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;

    console.log('Provider token available:', !!providerToken);

    if (providerToken) {
      // Get Microsoft user profile for microsoft_user_id
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${providerToken}` },
      });

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        const microsoftEmail = (
          profile.mail ||
          profile.userPrincipalName ||
          ''
        ).toLowerCase();

        console.log('Creating microsoft_connections for:', microsoftEmail);

        // Upsert microsoft_connections record
        const { error: connectionError } = await adminClient
          .from('microsoft_connections')
          .upsert(
            {
              user_id: existingUser.id,
              microsoft_user_id: profile.id,
              email: microsoftEmail,
              access_token: providerToken,
              refresh_token: providerRefreshToken || '',
              token_expires_at: new Date(
                Date.now() + 3600 * 1000
              ).toISOString(),
              scopes: [
                'openid',
                'profile',
                'email',
                'User.Read',
                'Calendars.ReadWrite',
                'Mail.ReadWrite',
                'Mail.Send',
                'offline_access',
              ],
              connected_at: new Date().toISOString(),
              is_active: true,
            },
            {
              onConflict: 'user_id',
            }
          );

        if (connectionError) {
          console.error('Failed to save Microsoft connection:', connectionError);
          // Continue anyway - user can reconnect later
        }
      } else {
        console.error('Failed to fetch Microsoft profile:', profileResponse.status);
      }
    }

    // Success - redirect to work
    console.log('Login successful, redirecting to /work');
    return NextResponse.redirect(`${baseUrl}/work`);
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }
}
