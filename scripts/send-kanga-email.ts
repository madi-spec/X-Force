import { config } from 'dotenv';
config({ path: '.env.local' });

import { SchedulingService } from '../src/lib/scheduler/schedulingService';

async function main() {
  const requestId = '06791f7a-94d4-4569-ae3b-b8da113916a4';
  const userId = '11111111-1111-1111-1111-111111111009'; // Brent Allen (creator/organizer)

  console.log('Sending scheduling email for Kanga Pest Control...');
  console.log('Request ID:', requestId);

  const schedulingService = new SchedulingService({ useAdmin: true });

  // First preview the email
  console.log('\n--- Previewing email ---');
  const preview = await schedulingService.previewSchedulingEmail(requestId, 'initial_outreach');

  if (!preview.success) {
    console.error('Preview failed:', preview.error);
    return;
  }

  console.log('Subject:', preview.email?.subject);
  console.log('To:', preview.email?.to);
  console.log('Proposed times:', preview.proposedTimes?.length, 'time slots');
  console.log('\nEmail body preview (first 500 chars):');
  console.log(preview.email?.body?.substring(0, 500) + '...');

  // Now send the email
  console.log('\n--- Sending email ---');
  const result = await schedulingService.sendSchedulingEmail(requestId, userId, {
    emailType: 'initial_outreach',
  });

  if (!result.success) {
    console.error('Send failed:', result.error);
    return;
  }

  console.log('\n✅ Email sent successfully!');
  console.log('Subject:', result.email?.subject);
  console.log('To:', result.email?.to);
  console.log('Proposed times:', result.proposedTimes?.length, 'time slots');
}

main().catch(console.error);
