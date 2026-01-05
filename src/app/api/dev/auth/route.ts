import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Development-only authentication bypass for Playwright testing
 *
 * This endpoint creates a valid Supabase session without requiring
 * Microsoft OAuth. It ONLY works in development mode.
 *
 * Usage:
 *   POST /api/dev/auth
 *   Body: { "email": "user@example.com" } (optional, uses first active user if not provided)
 *
 * Returns cookies that establish a valid session
 */
export async function POST(request: NextRequest) {
  // CRITICAL: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedEmail = body.email;

    const adminClient = createAdminClient();

    // Find the user to authenticate as
    let userQuery = adminClient
      .from('users')
      .select('id, email, name, auth_id')
      .eq('is_active', true);

    if (requestedEmail) {
      userQuery = userQuery.ilike('email', requestedEmail);
    }

    const { data: users, error: userError } = await userQuery.limit(1).single();

    if (userError || !users) {
      return NextResponse.json(
        { error: 'No active user found', details: userError?.message },
        { status: 404 }
      );
    }

    const targetUser = users;

    // Check if user has an auth_id (linked to Supabase auth)
    let authUserId = targetUser.auth_id;

    if (!authUserId) {
      // User doesn't have auth_id - we need to create a Supabase auth user
      // and link them
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email: targetUser.email,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: targetUser.name,
          dev_bypass: true,
        },
      });

      if (createError) {
        // User might already exist in auth but not linked
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingAuthUser = existingUsers?.users?.find(
          u => u.email?.toLowerCase() === targetUser.email.toLowerCase()
        );

        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
        } else {
          return NextResponse.json(
            { error: 'Failed to create auth user', details: createError.message },
            { status: 500 }
          );
        }
      } else {
        authUserId = authUser.user.id;
      }

      // Link the auth_id to the users table
      await adminClient
        .from('users')
        .update({ auth_id: authUserId })
        .eq('id', targetUser.id);
    }

    // Generate a magic link to create a session
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
    });

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: 'Failed to generate auth link', details: linkError?.message },
        { status: 500 }
      );
    }

    // Extract the token from the link
    const tokenHash = linkData.properties?.hashed_token;

    if (!tokenHash) {
      return NextResponse.json(
        { error: 'No token in generated link' },
        { status: 500 }
      );
    }

    // Use createServerClient with proper cookie handling (same pattern as auth callback)
    const cookieStore = await cookies();

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

    // Verify the OTP - this will automatically set cookies via the cookieStore
    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (verifyError || !sessionData.session) {
      return NextResponse.json(
        { error: 'Failed to create session', details: verifyError?.message },
        { status: 500 }
      );
    }

    // Return success - cookies are already set via cookieStore
    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
      message: 'Development auth bypass successful',
    });
  } catch (error) {
    console.error('[Dev Auth] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET handler - authenticates and redirects to the app
 * Use: /api/dev/auth?redirect=/work&email=user@example.com
 *
 * This is the preferred method for Playwright as it works with browser navigation
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const redirectTo = searchParams.get('redirect') || '/work';
  const requestedEmail = searchParams.get('email') || undefined;

  try {
    const adminClient = createAdminClient();

    // Find the user to authenticate as
    let userQuery = adminClient
      .from('users')
      .select('id, email, name, auth_id')
      .eq('is_active', true);

    if (requestedEmail) {
      userQuery = userQuery.ilike('email', requestedEmail);
    }

    const { data: users, error: userError } = await userQuery.limit(1).single();

    if (userError || !users) {
      return NextResponse.json(
        { error: 'No active user found', details: userError?.message },
        { status: 404 }
      );
    }

    const targetUser = users;

    // Check if user has an auth_id (linked to Supabase auth)
    let authUserId = targetUser.auth_id;

    if (!authUserId) {
      // User doesn't have auth_id - we need to create a Supabase auth user
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email: targetUser.email,
        email_confirm: true,
        user_metadata: {
          name: targetUser.name,
          dev_bypass: true,
        },
      });

      if (createError) {
        // User might already exist in auth but not linked
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingAuthUser = existingUsers?.users?.find(
          u => u.email?.toLowerCase() === targetUser.email.toLowerCase()
        );

        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
        } else {
          return NextResponse.json(
            { error: 'Failed to create auth user', details: createError.message },
            { status: 500 }
          );
        }
      } else {
        authUserId = authUser.user.id;
      }

      // Link the auth_id to the users table
      await adminClient
        .from('users')
        .update({ auth_id: authUserId })
        .eq('id', targetUser.id);
    }

    // Generate a magic link to create a session
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
    });

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: 'Failed to generate auth link', details: linkError?.message },
        { status: 500 }
      );
    }

    const tokenHash = linkData.properties?.hashed_token;

    if (!tokenHash) {
      return NextResponse.json(
        { error: 'No token in generated link' },
        { status: 500 }
      );
    }

    // Use createServerClient with proper cookie handling
    const cookieStore = await cookies();

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

    // Verify the OTP - this will automatically set cookies via the cookieStore
    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (verifyError || !sessionData.session) {
      return NextResponse.json(
        { error: 'Failed to create session', details: verifyError?.message },
        { status: 500 }
      );
    }

    // Build the redirect URL
    const baseUrl = request.nextUrl.origin;
    const redirectUrl = new URL(redirectTo, baseUrl);

    console.log('[Dev Auth] Authenticated as:', targetUser.email, '-> redirecting to:', redirectTo);

    // Cookies are already set via cookieStore, just redirect
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[Dev Auth] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
