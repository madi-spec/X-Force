import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - List all webhooks
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: webhooks, error } = await supabase
      .from('scheduler_webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(webhooks || []);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

// POST - Create new webhook
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      name,
      description,
      url,
      secret_key,
      auth_type = 'hmac',
      auth_value,
      events = [],
      filter_meeting_types,
      filter_users,
      custom_headers = {},
      max_retries = 3,
      retry_delay_seconds = 60,
      timeout_seconds = 30,
      auto_disable_after_failures = 10,
    } = body;

    // Validation
    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const { data: webhook, error } = await supabase
      .from('scheduler_webhooks')
      .insert({
        name,
        description,
        url,
        secret_key,
        auth_type,
        auth_value,
        events,
        filter_meeting_types,
        filter_users,
        custom_headers,
        max_retries,
        retry_delay_seconds,
        timeout_seconds,
        auto_disable_after_failures,
        is_active: true,
        is_verified: false,
        consecutive_failures: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
