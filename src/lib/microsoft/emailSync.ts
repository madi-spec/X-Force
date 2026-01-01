/**
 * @deprecated - This file is deprecated.
 *
 * Email sync has been migrated to the communicationHub:
 * - Use syncEmailsDirectToCommunications from '@/lib/communicationHub'
 * - Use syncRecentEmailsDirectToCommunications from '@/lib/communicationHub'
 *
 * For sending emails:
 * - Use sendEmail from '@/lib/microsoft/sendEmail'
 *
 * The re-export below is kept for backward compatibility only.
 * New code should import directly from the source modules.
 */

// Re-export sendEmail for backward compatibility
// New code should import from '@/lib/microsoft/sendEmail' directly
export { sendEmail } from './sendEmail';
