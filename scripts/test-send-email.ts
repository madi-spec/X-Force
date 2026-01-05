import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../src/lib/microsoft/auth';
import { MicrosoftGraphClient } from '../src/lib/microsoft/graph';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function testSendEmail() {
  const requestId = 'fd360b3e-b42a-4d52-b612-94b6e8b0e294';
  const userId = '11111111-1111-1111-1111-111111111009'; // Brent's user ID

  console.log('Testing email send for request:', requestId);

  // 1. Get a valid token for the user
  console.log('Getting token for user:', userId);
  const token = await getValidToken(userId);

  if (!token) {
    console.error('ERROR: No valid token available for user');
    return;
  }

  console.log('Got valid token');

  // 2. Try to send a test email
  const client = new MicrosoftGraphClient(token);

  try {
    console.log('Attempting to send email...');
    await client.sendMessage({
      subject: 'Test Email - Please Ignore',
      body: { contentType: 'Text', content: 'This is a test email from the X-FORCE scheduler. Please ignore.' },
      toRecipients: [{ emailAddress: { address: 'madi@theangryocto.com' } }],
    });
    console.log('Email sent successfully!');
  } catch (err) {
    console.error('ERROR sending email:', err);
  }
}

testSendEmail().catch(console.error);
