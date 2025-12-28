/**
 * Single Email Template API
 *
 * GET - Get template by ID
 * PUT - Update template
 * DELETE - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from '@/lib/scheduler/settingsService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await getEmailTemplate(id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (err) {
    console.error('[Templates API] GET Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    delete body.id;
    delete body.created_at;
    delete body.updated_at;

    const template = await updateEmailTemplate(id, body);

    return NextResponse.json({ data: template });
  } catch (err) {
    console.error('[Templates API] PUT Error:', err);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteEmailTemplate(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Templates API] DELETE Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
