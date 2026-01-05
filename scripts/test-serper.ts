import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '../.env.local') });

async function testSerper() {
  const apiKey = process.env.SERP_API_KEY;
  console.log('API Key:', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND');

  if (!apiKey) {
    console.log('No API key found');
    return;
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: 'Go-Forth Pest Control PCT Top 100',
        num: 3,
        gl: 'us',
        hl: 'en',
      }),
    });

    console.log('Status:', response.status, response.statusText);

    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
  } catch (error) {
    console.error('Error:', error);
  }
}

testSerper();
