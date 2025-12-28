/**
 * SMS Module
 *
 * Twilio SMS integration for multi-channel scheduling outreach.
 */

export {
  sendSms,
  sendSchedulingSms,
  generateInitialSms,
  generateFollowUpSms,
  generateConfirmationSms,
  generateReminderSms,
  generateDeEscalationSms,
  formatPhoneNumber,
  isValidSmsNumber,
  extractPhoneFromContact,
  parseSmsIntent,
  type TwilioConfig,
  type SendSmsInput,
  type SendSmsResult,
  type IncomingSms,
  type SmsTemplateContext,
} from './twilioService';
