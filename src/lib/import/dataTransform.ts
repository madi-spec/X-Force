// Data transformation utilities for CSV import

/**
 * Clean and parse currency values from various formats
 * Handles: $1,234.56, 1234.56, $1,234, (1,234) for negatives, 1.234,56 European
 */
export function cleanCurrencyValue(value: string | undefined): number | undefined {
  if (!value || !value.trim()) return undefined;

  let cleaned = value.trim();

  // Check for negative in parentheses: (1,234)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }

  // Check for negative sign
  const hasNegativeSign = cleaned.startsWith('-');
  if (hasNegativeSign) {
    cleaned = cleaned.slice(1);
  }

  // Remove currency symbols and spaces
  cleaned = cleaned.replace(/[$€£¥\s]/g, '');

  // Handle K/M suffixes (e.g., "50K" = 50000, "1.5M" = 1500000)
  let multiplier = 1;
  if (cleaned.toUpperCase().endsWith('K')) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.toUpperCase().endsWith('M')) {
    multiplier = 1000000;
    cleaned = cleaned.slice(0, -1);
  }

  // Detect European format (1.234,56) vs US format (1,234.56)
  // European: dots for thousands, comma for decimal
  // US: commas for thousands, dot for decimal
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot && lastComma === cleaned.length - 3) {
    // European format: 1.234,56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format or no decimals: remove commas
    cleaned = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return undefined;

  const result = num * multiplier;
  return (isNegative || hasNegativeSign) ? -result : result;
}

/**
 * Clean and normalize phone numbers
 * Strips non-digits, handles international prefixes
 */
export function cleanPhoneNumber(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return undefined;

  let cleaned = value.trim();

  // Remove common formatting characters
  cleaned = cleaned.replace(/[\s\-\.\(\)]/g, '');

  // Handle + prefix for international
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');

  // If empty after cleaning, return undefined
  if (!cleaned) return undefined;

  // Add back + for international numbers
  if (hasPlus && cleaned.length > 10) {
    return '+' + cleaned;
  }

  // For US numbers, ensure 10 digits (strip leading 1 if 11 digits)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    cleaned = cleaned.slice(1);
  }

  return cleaned || undefined;
}

/**
 * Parse date strings from various formats
 * Handles: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, "Jan 15, 2024", etc.
 */
export function parseDate(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return undefined;

  const cleaned = value.trim();

  // Try native Date parsing first (handles ISO and many formats)
  const nativeDate = new Date(cleaned);
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() > 1900) {
    return nativeDate.toISOString();
  }

  // Try MM/DD/YYYY or M/D/YYYY
  const slashParts = cleaned.split('/');
  if (slashParts.length === 3) {
    const [first, second, third] = slashParts.map(p => parseInt(p, 10));

    // Determine if MM/DD/YYYY or DD/MM/YYYY based on values
    let month: number, day: number, year: number;

    if (third > 100) {
      // Third part is full year
      year = third;
      if (first > 12) {
        // DD/MM/YYYY (first > 12 means it's a day)
        day = first;
        month = second;
      } else if (second > 12) {
        // MM/DD/YYYY (second > 12 means it's a day)
        month = first;
        day = second;
      } else {
        // Ambiguous, assume MM/DD/YYYY (US format)
        month = first;
        day = second;
      }
    } else {
      // Two-digit year
      year = third < 50 ? 2000 + third : 1900 + third;
      month = first;
      day = second;
    }

    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  // Try DD-MM-YYYY or YYYY-MM-DD with dashes
  const dashParts = cleaned.split('-');
  if (dashParts.length === 3) {
    const [first, second, third] = dashParts.map(p => parseInt(p, 10));

    let year: number, month: number, day: number;
    if (first > 100) {
      // YYYY-MM-DD
      year = first;
      month = second;
      day = third;
    } else {
      // DD-MM-YYYY
      day = first;
      month = second;
      year = third < 50 ? 2000 + third : (third < 100 ? 1900 + third : third);
    }

    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return undefined;
}

/**
 * Parse boolean values from various string representations
 */
export function parseBoolean(value: string | undefined): boolean {
  if (!value || !value.trim()) return false;

  const lower = value.toLowerCase().trim();

  // Truthy values
  const truthyValues = ['true', 'yes', 'y', '1', 'on', 'x', 'checked', 'enabled'];

  return truthyValues.includes(lower);
}

/**
 * Normalize string value (trim whitespace, handle empty)
 */
export function normalizeString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Parse integer from string
 */
export function parseInteger(value: string | undefined): number | undefined {
  if (!value || !value.trim()) return undefined;
  const cleaned = value.replace(/[,\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}
