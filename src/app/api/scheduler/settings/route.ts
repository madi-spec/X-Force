/**
 * Scheduler Settings API
 *
 * GET - Get scheduler settings (global or user-specific)
 * PUT - Update scheduler settings
 * DELETE - Reset user settings to defaults
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSchedulerSettings,
  updateSchedulerSettings,
  resetUserSettings,
} from '@/lib/scheduler/settingsService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || undefined;

    const settings = await getSchedulerSettings(userId);

    return NextResponse.json({ data: settings });
  } catch (err) {
    console.error('[Settings API] GET Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400 }
      );
    }

    const updated = await updateSchedulerSettings(settings, userId);

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[Settings API] PUT Error:', err);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required to reset user settings' },
        { status: 400 }
      );
    }

    await resetUserSettings(userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Settings API] DELETE Error:', err);
    return NextResponse.json(
      { error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}
