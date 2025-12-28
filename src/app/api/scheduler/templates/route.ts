/**
 * Email Templates API
 *
 * GET - List all email templates
 * POST - Create new template
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailTemplates,
  createEmailTemplate,
} from '@/lib/scheduler/settingsService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const template_type = searchParams.get('type') || undefined;
    const meeting_type = searchParams.get('meeting_type') || undefined;
    const is_active = searchParams.get('active');

    const templates = await getEmailTemplates({
      template_type,
      meeting_type,
      is_active: is_active === null ? undefined : is_active === 'true',
    });

    return NextResponse.json({ data: templates });
  } catch (err) {
    console.error('[Templates API] GET Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { name, slug, template_type, subject_template, body_template } = body;

    if (!name || !slug || !template_type || !subject_template || !body_template) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, template_type, subject_template, body_template' },
        { status: 400 }
      );
    }

    const template = await createEmailTemplate(body);

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    console.error('[Templates API] POST Error:', err);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
