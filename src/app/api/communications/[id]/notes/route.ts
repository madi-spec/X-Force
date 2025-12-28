/**
 * GET/POST /api/communications/[id]/notes
 *
 * Get notes for a communication or add a new note.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface CommunicationNote {
  id: string;
  communication_id: string;
  user_id: string;
  note_type: 'manual' | 'action' | 'system';
  action_type: string | null;
  content: string;
  attention_flag_id: string | null;
  created_at: string;
  user?: {
    id: string;
    name: string;
  };
}

interface CreateNoteBody {
  content: string;
  note_type?: 'manual' | 'action' | 'system';
  action_type?: string;
  attention_flag_id?: string;
}

// GET - Fetch notes for a communication
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: notes, error } = await supabase
      .from('communication_notes')
      .select(`
        *,
        user:users(id, name)
      `)
      .eq('communication_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CommunicationNotes] Error fetching notes:', error);
      throw error;
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    console.error('[CommunicationNotes] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get user
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse body
    const body: CreateNoteBody = await request.json();

    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    // Verify the communication exists
    const { data: comm, error: fetchError } = await supabase
      .from('communications')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !comm) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    // Create the note
    const { data: note, error: insertError } = await supabase
      .from('communication_notes')
      .insert({
        communication_id: id,
        user_id: dbUser.id,
        note_type: body.note_type || 'manual',
        action_type: body.action_type || null,
        content: body.content.trim(),
        attention_flag_id: body.attention_flag_id || null,
      })
      .select(`
        *,
        user:users(id, name)
      `)
      .single();

    if (insertError) {
      console.error('[CommunicationNotes] Error creating note:', insertError);
      throw insertError;
    }

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error('[CommunicationNotes] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
