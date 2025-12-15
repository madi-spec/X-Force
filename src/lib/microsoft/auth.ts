import { createClient } from '@/lib/supabase/server';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * Get a valid access token for a user, refreshing if necessary
 */
export async function getValidToken(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: connection, error } = await supabase
    .from('microsoft_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !connection) {
    return null;
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    // Token still valid
    return connection.access_token;
  }

  // Token expired or about to expire, refresh it
  return await refreshToken(userId, connection.refresh_token);
}

/**
 * Refresh an access token using the refresh token
 */
async function refreshToken(userId: string, refreshTokenValue: string): Promise<string | null> {
  const supabase = await createClient();

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: refreshTokenValue,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await response.json();

    if (tokens.error) {
      console.error('Token refresh failed:', tokens.error_description);
      // Mark connection as inactive
      await supabase
        .from('microsoft_connections')
        .update({ is_active: false })
        .eq('user_id', userId);
      return null;
    }

    // Update stored tokens
    const { error: updateError } = await supabase
      .from('microsoft_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshTokenValue, // Keep old if not provided
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update tokens:', updateError);
      return null;
    }

    return tokens.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

/**
 * Check if a user has an active Microsoft connection
 */
export async function hasActiveConnection(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('microsoft_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  return !error && !!data;
}

/**
 * Get the Microsoft connection for a user
 */
export async function getConnection(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('microsoft_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Disconnect a user's Microsoft account
 */
export async function disconnectMicrosoft(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('microsoft_connections')
    .delete()
    .eq('user_id', userId);

  return !error;
}

/**
 * Update the last sync timestamp
 */
export async function updateLastSync(userId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('microsoft_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId);
}
