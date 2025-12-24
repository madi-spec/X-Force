/**
 * Email Content Cleaner
 *
 * Strips boilerplate headers, footers, and security warnings from email content
 * before AI analysis to reduce noise and improve analysis quality.
 */

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
