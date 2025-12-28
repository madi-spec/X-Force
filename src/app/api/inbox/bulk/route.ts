import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { bulkArchive, bulkSnooze, bulkLink } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// POST - Bulk actions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile user_id (email tables use this, not auth user id)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, conversationIds, ...options } = body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds array required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'archive':
        result = await bulkArchive(profile.id, conversationIds);
        break;

      case 'snooze':
        if (!options.until) {
          return NextResponse.json(
            { error: 'Snooze requires "until" date' },
            { status: 400 }
          );
        }
        result = await bulkSnooze(profile.id, conversationIds, {
          until: new Date(options.until),
          reason: options.reason,
        });
        break;

      case 'link':
        if (!options.dealId) {
          return NextResponse.json(
            { error: 'Link requires "dealId"' },
            { status: 400 }
          );
        }
        result = await bulkLink(profile.id, conversationIds, options.dealId);
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error performing bulk action:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
