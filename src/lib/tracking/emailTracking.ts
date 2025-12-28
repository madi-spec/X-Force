/**
 * Email Tracking Injection Service
 * Injects tracking pixels and wraps links for email open/click tracking
 */

import {
  createTrackingToken,
  createLinkTrackingToken,
  getTrackingPixelUrl,
  getTrackedLinkUrl,
} from './tokens';
import { TrackingContext } from '@/types/engagement';

// ============================================
// TYPES
// ============================================

export interface TrackingOptions {
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface TrackingResult {
  html: string;
  pixelToken?: string;
  linkTokens: Map<string, string>;
  linksTracked: number;
}

// ============================================
// LINK EXTRACTION
// ============================================

/**
 * Extract all links from HTML content
 * Returns array of { url, text, position, fullMatch }
 */
function extractLinks(html: string): Array<{
  url: string;
  text: string;
  position: number;
  fullMatch: string;
}> {
  const links: Array<{
    url: string;
    text: string;
    position: number;
    fullMatch: string;
  }> = [];

  // Match <a href="...">...</a> tags
  const linkRegex = /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  let position = 0;

  while ((match = linkRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const url = match[2];
    const text = stripHtml(match[3]).trim();

    // Skip mailto:, tel:, and anchor links
    if (
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('#') ||
      url.startsWith('javascript:')
    ) {
      continue;
    }

    // Skip tracking/unsubscribe links (common patterns)
    if (
      url.includes('unsubscribe') ||
      url.includes('optout') ||
      url.includes('manage-preferences')
    ) {
      continue;
    }

    position++;
    links.push({
      url,
      text: text.substring(0, 100), // Limit text length
      position,
      fullMatch,
    });
  }

  return links;
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// ============================================
// TRACKING INJECTION
// ============================================

/**
 * Inject tracking into email HTML
 * - Adds tracking pixel for open tracking
 * - Wraps links with click tracking redirects
 */
export async function injectTracking(
  html: string,
  context: TrackingContext,
  options: TrackingOptions = { trackOpens: true, trackClicks: true }
): Promise<TrackingResult> {
  const result: TrackingResult = {
    html,
    linkTokens: new Map(),
    linksTracked: 0,
  };

  // Track opens - inject pixel
  if (options.trackOpens) {
    const pixelToken = await createTrackingToken(context);
    result.pixelToken = pixelToken;
    result.html = injectTrackingPixel(result.html, pixelToken);
  }

  // Track clicks - wrap links
  if (options.trackClicks) {
    const links = extractLinks(result.html);

    // Create tokens for each link
    for (const link of links) {
      const token = await createLinkTrackingToken(
        context,
        link.url,
        link.text,
        link.position
      );
      result.linkTokens.set(link.url, token);
    }

    // Replace links with tracked versions
    result.html = await wrapLinksWithTracking(result.html, links, result.linkTokens);
    result.linksTracked = links.length;
  }

  return result;
}

/**
 * Inject tracking pixel before </body> or at end of HTML
 */
function injectTrackingPixel(html: string, token: string): string {
  const pixelUrl = getTrackingPixelUrl(token);
  const pixelHtml = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;

  // Try to inject before </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelHtml}</body>`);
  }

  // Try to inject before </html>
  if (html.includes('</html>')) {
    return html.replace('</html>', `${pixelHtml}</html>`);
  }

  // Just append at the end
  return html + pixelHtml;
}

/**
 * Wrap all links with tracking redirects
 */
async function wrapLinksWithTracking(
  html: string,
  links: Array<{ url: string; text: string; position: number; fullMatch: string }>,
  tokenMap: Map<string, string>
): Promise<string> {
  let result = html;

  // Process links in reverse order to maintain positions
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    const token = tokenMap.get(link.url);

    if (!token) continue;

    const trackedUrl = getTrackedLinkUrl(token, link.url);

    // Replace the href in the original link
    const newLink = link.fullMatch.replace(
      /href=["'][^"']+["']/,
      `href="${trackedUrl}"`
    );

    result = result.replace(link.fullMatch, newLink);
  }

  return result;
}

// ============================================
// PLAIN TEXT TRACKING
// ============================================

/**
 * Inject tracking pixel into plain text email
 * Returns HTML wrapper with pixel
 */
export async function wrapPlainTextWithTracking(
  text: string,
  context: TrackingContext
): Promise<string> {
  const pixelToken = await createTrackingToken(context);
  const pixelUrl = getTrackingPixelUrl(pixelToken);

  // Wrap plain text in minimal HTML with tracking pixel
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<pre style="font-family: inherit; white-space: pre-wrap;">${escapeHtml(text)}</pre>
<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
</body>
</html>`;
}

/**
 * Escape HTML entities in text
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// TRACKING CONTEXT BUILDER
// ============================================

/**
 * Build tracking context from email send parameters
 */
export function buildTrackingContext(params: {
  userId: string;
  contactId?: string;
  dealId?: string;
  emailId?: string;
  sourceType?: 'email' | 'proposal' | 'website' | 'document';
}): TrackingContext {
  return {
    user_id: params.userId,
    contact_id: params.contactId,
    deal_id: params.dealId,
    email_id: params.emailId,
    source_type: params.sourceType || 'email',
    source_id: params.emailId,
    track_opens: true,
    track_clicks: true,
  };
}
