import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disconnectMicrosoft } from '@/lib/microsoft/auth';

/**
 * Disconnect Microsoft 365 account
 * POST /api/microsoft/disconnect
 */
export async function POST() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Disconnect Microsoft account
  const success = await disconnectMicrosoft(profile.id);

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
