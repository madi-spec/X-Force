import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupTrackingToken } from '@/lib/tracking/tokens';

/**
 * 1x1 transparent GIF (43 bytes)
 * This is the smallest valid GIF that renders as transparent
 */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /api/track/open
 *
 * Tracking pixel endpoint for email opens.
 * Records the open event and returns a 1x1 transparent GIF.
 *
 * Query params:
 * - t: tracking token
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('t');

    if (!token) {
      return new Response(TRANSPARENT_GIF, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      });
    }

    // Look up the token
    const tokenData = await lookupTrackingToken(token);

    if (!tokenData) {
      // Invalid or expired token - still return the GIF
      return new Response(TRANSPARENT_GIF, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      });
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

    // Check if this is the first open
    const isFirstOpen = tokenData.open_count === 0;

    // Insert engagement event
    await supabase.from('engagement_events').insert({
      user_id: tokenData.user_id,
      contact_id: tokenData.contact_id,
      deal_id: tokenData.deal_id,
      event_type: 'email_opened',
      source_type: tokenData.source_type,
      source_id: tokenData.source_id,
      metadata: {
        is_first_open: isFirstOpen,
        open_count: tokenData.open_count + 1,
      },
      ip_address: ip,
      user_agent: userAgent,
      device_type: deviceType,
      occurred_at: new Date().toISOString(),
    });

    // Update token open count
    const now = new Date().toISOString();
    await supabase
      .from('tracking_tokens')
      .update({
        open_count: tokenData.open_count + 1,
        first_opened_at: tokenData.first_opened_at || now,
        last_opened_at: now,
      })
      .eq('id', tokenData.id);

  } catch (error) {
    // Log error but still return the GIF
    console.error('Error recording email open:', error);
  }

  // Always return the transparent GIF
  return new Response(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
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
