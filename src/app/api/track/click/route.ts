import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupTrackingToken } from '@/lib/tracking/tokens';

/**
 * GET /api/track/click
 *
 * Link click tracking endpoint.
 * Records the click event and redirects to the original URL.
 *
 * Query params:
 * - t: tracking token
 * - u: encoded original URL (fallback if not in token)
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  const fallbackUrl = request.nextUrl.searchParams.get('u');

  // Decode the fallback URL
  let redirectUrl = fallbackUrl ? decodeURIComponent(fallbackUrl) : null;

  if (!token) {
    // No token - redirect to fallback or home
    return NextResponse.redirect(redirectUrl || '/');
  }

  try {
    // Look up the token
    const tokenData = await lookupTrackingToken(token);

    if (!tokenData) {
      // Invalid or expired token - redirect to fallback
      return NextResponse.redirect(redirectUrl || '/');
    }

    // Use the original URL from token (more trustworthy than query param)
    redirectUrl = tokenData.original_url || redirectUrl;

    if (!redirectUrl) {
      // No URL to redirect to
      return NextResponse.redirect('/');
    }

    // Record the engagement event
    const supabase = createAdminClient();

    // Get IP and user agent
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               null;
    const userAgent = request.headers.get('user-agent') || null;

    // Determine device type
    const deviceType = getDeviceType(userAgent);

    // Insert engagement event
    await supabase.from('engagement_events').insert({
      user_id: tokenData.user_id,
      contact_id: tokenData.contact_id,
      deal_id: tokenData.deal_id,
      event_type: 'email_clicked',
      source_type: tokenData.source_type,
      source_id: tokenData.source_id,
      metadata: {
        url: redirectUrl,
        link_text: tokenData.link_text,
        link_position: tokenData.link_position,
        click_count: tokenData.click_count + 1,
      },
      ip_address: ip,
      user_agent: userAgent,
      device_type: deviceType,
      occurred_at: new Date().toISOString(),
    });

    // Update token click count
    await supabase
      .from('tracking_tokens')
      .update({
        click_count: tokenData.click_count + 1,
      })
      .eq('id', tokenData.id);

  } catch (error) {
    // Log error but still redirect
    console.error('Error recording link click:', error);
  }

  // Validate the redirect URL (prevent open redirect vulnerability)
  if (!redirectUrl || !isValidRedirectUrl(redirectUrl)) {
    console.warn('Invalid redirect URL blocked:', redirectUrl);
    return NextResponse.redirect('/');
  }

  // Redirect to the original URL
  return NextResponse.redirect(redirectUrl);
}

/**
 * Determine device type from user agent
 */
function getDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }

  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }

  return 'desktop';
}

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allows http/https URLs
 */
function isValidRedirectUrl(url: string | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
