import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { connectFireflies, disconnectFireflies } from '@/lib/fireflies';

/**
 * Connect Fireflies account
 * POST /api/integrations/fireflies/connect
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Parse request body
  const body = await request.json();
  const { apiKey, autoAnalyze, autoCreateDrafts, autoCreateTasks } = body;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  // Connect to Fireflies
  const result = await connectFireflies(profile.id, apiKey, {
    autoAnalyze,
    autoCreateDrafts,
    autoCreateTasks,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    userEmail: result.userEmail,
  });
}

/**
 * Disconnect Fireflies account
 * DELETE /api/integrations/fireflies/connect
 */
export async function DELETE() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Disconnect
  const success = await disconnectFireflies(profile.id);

  return NextResponse.json({ success });
}
