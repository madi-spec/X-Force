/**
 * Tracking Token Service
 * Generates and decodes short tokens for email tracking URLs
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { TrackingContext, TrackingToken } from '@/types/engagement';
import { randomBytes } from 'crypto';

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a short, URL-safe token
 */
function generateShortToken(): string {
  // 12 bytes = 16 chars in base64url, plenty unique
  return randomBytes(12)
    .toString('base64url')
    .replace(/[_-]/g, 'x'); // Extra safe for URLs
}

/**
 * Create a tracking token for an email
 * Returns the short token string to use in URLs
 */
export async function createTrackingToken(
  context: TrackingContext
): Promise<string> {
  const supabase = createAdminClient();
  const token = generateShortToken();

  const { error } = await supabase.from('tracking_tokens').insert({
    token,
    user_id: context.user_id,
    contact_id: context.contact_id,
    deal_id: context.deal_id,
    source_type: context.source_type,
    source_id: context.source_id || context.email_id,
  });

  if (error) {
    console.error('Failed to create tracking token:', error);
    throw new Error('Failed to create tracking token');
  }

  return token;
}

/**
 * Create a tracking token for a specific link
 */
export async function createLinkTrackingToken(
  context: TrackingContext,
  originalUrl: string,
  linkText?: string,
  linkPosition?: number
): Promise<string> {
  const supabase = createAdminClient();
  const token = generateShortToken();

  const { error } = await supabase.from('tracking_tokens').insert({
    token,
    user_id: context.user_id,
    contact_id: context.contact_id,
    deal_id: context.deal_id,
    source_type: context.source_type,
    source_id: context.source_id || context.email_id,
    original_url: originalUrl,
    link_text: linkText?.substring(0, 255),
    link_position: linkPosition,
  });

  if (error) {
    console.error('Failed to create link tracking token:', error);
    throw new Error('Failed to create link tracking token');
  }

  return token;
}

// ============================================
// TOKEN LOOKUP
// ============================================

/**
 * Look up a tracking token and return its context
 * Returns null if token is invalid or expired
 */
export async function lookupTrackingToken(
  token: string
): Promise<TrackingToken | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('tracking_tokens')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data as TrackingToken;
}

/**
 * Increment open count for a token
 */
export async function incrementOpenCount(tokenId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('tracking_tokens')
    .update({
      open_count: supabase.rpc('increment_open_count', { token_id: tokenId }),
      first_opened_at: new Date().toISOString(),
      last_opened_at: new Date().toISOString(),
    })
    .eq('id', tokenId);

  // Simpler approach without RPC:
  await supabase.rpc('increment_token_open', { p_token_id: tokenId });
}

/**
 * Increment click count for a token
 */
export async function incrementClickCount(tokenId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase.rpc('increment_token_click', { p_token_id: tokenId });
}

// ============================================
// URL GENERATION
// ============================================

/**
 * Get the base URL for tracking (uses APP_URL or falls back)
 */
function getTrackingBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.x-rai.com';
}

/**
 * Generate tracking pixel URL
 */
export function getTrackingPixelUrl(token: string): string {
  const baseUrl = getTrackingBaseUrl();
  return `${baseUrl}/api/track/open?t=${token}`;
}

/**
 * Generate tracked link URL
 */
export function getTrackedLinkUrl(token: string, originalUrl: string): string {
  const baseUrl = getTrackingBaseUrl();
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${baseUrl}/api/track/click?t=${token}&u=${encodedUrl}`;
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Create tokens for all links in an email
 * Returns a map of original URL -> tracking token
 */
export async function createTokensForLinks(
  context: TrackingContext,
  links: Array<{ url: string; text?: string; position: number }>
): Promise<Map<string, string>> {
  const tokenMap = new Map<string, string>();

  // Create tokens in parallel
  await Promise.all(
    links.map(async (link) => {
      const token = await createLinkTrackingToken(
        context,
        link.url,
        link.text,
        link.position
      );
      tokenMap.set(link.url, token);
    })
  );

  return tokenMap;
}

/**
 * Clean up expired tokens (called by cron)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('tracking_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Failed to cleanup expired tokens:', error);
    return 0;
  }

  return data?.length || 0;
}
