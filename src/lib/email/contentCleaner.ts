/**
 * Email Content Cleaner
 *
 * Strips boilerplate headers, footers, and security warnings from email content
 * before AI analysis to reduce noise and improve analysis quality.
 */

/**
 * Convert HTML content to plain text.
 * Strips HTML tags and decodes common entities.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';

  let text = html
    // Remove style and script blocks entirely
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Convert <br> and block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Clean up whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return text;
}

/**
 * Patterns to strip from email content before analysis.
 * These are boilerplate headers/footers that add noise.
 */
const CONTENT_STRIP_PATTERNS = [
  // External email security warnings (common corporate pattern)
  /CAUTION:\s*This email originated from outside your organization\.[\s\S]*?(?:forward to \S+@\S+ for evaluation\.?\s*>+|$)/gi,
  /This email originated from outside.*?(?:clicking links|unknown senders).*?(?:\r?\n)+/gi,
  /Exercise caution when opening attachments or clicking links.*?(?:\r?\n)+/gi,
  /\[?EXTERNAL\]?\s*-?\s*This email originated from outside/gi,
  // Common confidentiality footers (use [\s\S] instead of . with s flag)
  /This email and any attachments are confidential[\s\S]*?(?=\n\n|$)/gi,
  /CONFIDENTIALITY NOTICE:[\s\S]*?(?=\n\n|$)/gi,
  /This message contains confidential information[\s\S]*?(?=\n\n|$)/gi,
  // Auto-generated unsubscribe blocks
  /If you no longer wish to receive.*?unsubscribe.*?(?:\r?\n)+/gi,
  /To unsubscribe from this mailing list.*?(?:\r?\n)+/gi,
  // Email client signature separators with trailing content (common)
  /^--\s*\r?\n[\s\S]*$/m,
  // Outlook-style disclaimers
  /This email has been scanned for viruses.*?(?:\r?\n)+/gi,
];

/**
 * Clean email content by removing boilerplate headers/footers
 */
export function cleanEmailContent(content: string): string {
  if (!content) return content;

  let cleaned = content;
  for (const pattern of CONTENT_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Prepare email content for AI analysis.
 * 1. Converts HTML to plain text
 * 2. Strips boilerplate headers/footers (CAUTION warnings, disclaimers, etc.)
 * 3. Normalizes whitespace
 *
 * This ensures the AI sees the actual message content, not buried under warnings.
 */
export function prepareEmailForAI(htmlOrText: string | null | undefined): string {
  if (!htmlOrText) return '';

  // Step 1: Convert HTML to plain text
  const plainText = htmlToPlainText(htmlOrText);

  // Step 2: Clean boilerplate content
  const cleaned = cleanEmailContent(plainText);

  return cleaned;
}
