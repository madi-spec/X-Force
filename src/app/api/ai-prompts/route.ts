import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllPrompts } from '@/lib/ai/promptManager';

export async function GET() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prompts = await getAllPrompts();

  return NextResponse.json({ prompts });
}
