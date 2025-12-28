import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  archiveConversation,
  unarchiveConversation,
  snoozeConversation,
  unsnoozeConversation,
  linkConversation,
  unlinkConversation,
  ignoreConversation,
  updatePriority,
  undoAction,
} from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// POST - Perform action on conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...options } = body;

    let result;

    switch (action) {
      case 'archive':
        result = await archiveConversation(user.id, id, options);
        break;

      case 'unarchive':
        result = await unarchiveConversation(user.id, id);
        break;

      case 'snooze':
        if (!options.until) {
          return NextResponse.json(
            { error: 'Snooze requires "until" date' },
            { status: 400 }
          );
        }
        result = await snoozeConversation(user.id, id, {
          until: new Date(options.until),
          reason: options.reason,
        });
        break;

      case 'unsnooze':
        result = await unsnoozeConversation(user.id, id);
        break;

      case 'link':
        result = await linkConversation(user.id, id, {
          dealId: options.dealId,
          companyId: options.companyId,
          contactId: options.contactId,
        });
        break;

      case 'unlink':
        result = await unlinkConversation(user.id, id);
        break;

      case 'ignore':
        result = await ignoreConversation(user.id, id);
        break;

      case 'priority':
        if (!options.priority) {
          return NextResponse.json(
            { error: 'Priority action requires "priority" value' },
            { status: 400 }
          );
        }
        result = await updatePriority(user.id, id, options.priority);
        break;

      case 'undo':
        if (!options.actionId) {
          return NextResponse.json(
            { error: 'Undo requires "actionId"' },
            { status: 400 }
          );
        }
        result = await undoAction(user.id, options.actionId);
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error performing action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
