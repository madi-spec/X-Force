/**
 * Relationship Notes API
 *
 * GET /api/relationships/[contactId]/notes
 * Returns all notes for a contact's relationship
 *
 * POST /api/relationships/[contactId]/notes
 * Adds a new note to the relationship
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { addRelationshipNote } from '@/lib/intelligence/relationshipStore';

// Helper to get internal user ID from auth user
async function getInternalUserId(authUserId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUserId)
    .single();
  return dbUser?.id || null;
}

interface NoteResponse {
  id: string;
  note: string;
  context_type: 'strategy' | 'insight' | 'warning' | 'general';
  added_at: string;
  added_by_name: string | null;
  linked_source_type: string | null;
  linked_source_id: string | null;
  linked_item_id: string | null;
}

// ============================================
// GET - Get all notes for a contact
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { contactId } = await params;
    const supabase = createAdminClient();

    // Verify contact exists and user has access
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, email, company_id')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Get notes for this contact
    const { data: notes, error: notesError } = await supabase
      .from('relationship_notes')
      .select(`
        id, note, context_type, added_at,
        linked_source_type, linked_source_id, linked_item_id,
        added_by_user:users!relationship_notes_added_by_fkey(name)
      `)
      .eq('contact_id', contactId)
      .order('added_at', { ascending: false });

    if (notesError) {
      console.error('[RelationshipNotes] Error fetching notes:', notesError);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    const formattedNotes: NoteResponse[] = (notes || []).map((n) => {
      const userObj = Array.isArray(n.added_by_user) ? n.added_by_user[0] : n.added_by_user;
      return {
        id: n.id,
        note: n.note,
        context_type: n.context_type || 'general',
        added_at: n.added_at,
        added_by_name: userObj?.name || null,
        linked_source_type: n.linked_source_type,
        linked_source_id: n.linked_source_id,
        linked_item_id: n.linked_item_id,
      };
    });

    // Also get company-level notes if contact has company
    let companyNotes: NoteResponse[] = [];
    if (contact.company_id) {
      const { data: cNotes } = await supabase
        .from('relationship_notes')
        .select(`
          id, note, context_type, added_at,
          linked_source_type, linked_source_id, linked_item_id,
          added_by_user:users!relationship_notes_added_by_fkey(name)
        `)
        .eq('company_id', contact.company_id)
        .is('contact_id', null)
        .order('added_at', { ascending: false });

      if (cNotes) {
        companyNotes = cNotes.map((n) => {
          const userObj = Array.isArray(n.added_by_user) ? n.added_by_user[0] : n.added_by_user;
          return {
            id: n.id,
            note: n.note,
            context_type: n.context_type || 'general',
            added_at: n.added_at,
            added_by_name: userObj?.name || null,
            linked_source_type: n.linked_source_type,
            linked_source_id: n.linked_source_id,
            linked_item_id: n.linked_item_id,
          };
        });
      }
    }

    return NextResponse.json({
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
      },
      contactNotes: formattedNotes,
      companyNotes,
      totalNotes: formattedNotes.length + companyNotes.length,
    });
  } catch (error) {
    console.error('[RelationshipNotes] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST - Add a new note
// ============================================

interface AddNoteRequest {
  note: string;
  contextType?: 'strategy' | 'insight' | 'warning' | 'general';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { contactId } = await params;
    const body: AddNoteRequest = await request.json();

    if (!body.note || body.note.trim().length === 0) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify contact exists
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, company_id')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Add the note
    const note = await addRelationshipNote({
      contactId,
      companyId: contact.company_id || undefined,
      note: body.note.trim(),
      contextType: body.contextType || 'general',
      addedBy: userId,
    });

    return NextResponse.json({
      success: true,
      noteId: note.id,
      addedAt: note.added_at,
    });
  } catch (error) {
    console.error('[RelationshipNotes] POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
