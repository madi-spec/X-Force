import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Types for notes and corrections
interface SalespersonNote {
  id: string;
  note: string;
  field?: string; // Optional: which field this note relates to
  created_at: string;
  created_by: string;
  created_by_name?: string;
}

interface SalespersonCorrection {
  id: string;
  field: string;
  original_value: unknown;
  corrected_value: unknown;
  reason?: string;
  created_at: string;
  created_by: string;
  created_by_name?: string;
  status: 'pending' | 'applied' | 'rejected';
}

// GET: Retrieve notes and corrections for a company's relationship intelligence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get relationship intelligence with notes
    const { data: ri, error } = await supabase
      .from('relationship_intelligence')
      .select('salesperson_notes, salesperson_corrections')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      notes: ri?.salesperson_notes || [],
      corrections: ri?.salesperson_corrections || [],
    });
  } catch (err) {
    console.error('Error fetching notes:', err);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// POST: Add a new note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const body = await request.json();
    const { note, field } = body;

    if (!note || typeof note !== 'string') {
      return NextResponse.json(
        { error: 'Note text is required' },
        { status: 400 }
      );
    }

    // Get or create relationship intelligence record
    let { data: ri, error: riError } = await supabase
      .from('relationship_intelligence')
      .select('id, salesperson_notes')
      .eq('company_id', companyId)
      .maybeSingle();

    if (riError && riError.code !== 'PGRST116') {
      throw riError;
    }

    const newNote: SalespersonNote = {
      id: crypto.randomUUID(),
      note: note.trim(),
      field: field || undefined,
      created_at: new Date().toISOString(),
      created_by: user.id,
      created_by_name: profile?.name || user.email || 'Unknown',
    };

    const existingNotes = (ri?.salesperson_notes || []) as SalespersonNote[];
    const updatedNotes = [...existingNotes, newNote];

    if (ri) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('relationship_intelligence')
        .update({
          salesperson_notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ri.id);

      if (updateError) throw updateError;
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('relationship_intelligence')
        .insert({
          company_id: companyId,
          salesperson_notes: updatedNotes,
          context: {},
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, note: newNote });
  } catch (err) {
    console.error('Error adding note:', err);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}

// DELETE: Remove a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteId } = await request.json();

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Get existing notes
    const { data: ri, error: riError } = await supabase
      .from('relationship_intelligence')
      .select('id, salesperson_notes')
      .eq('company_id', companyId)
      .single();

    if (riError) throw riError;

    const existingNotes = (ri?.salesperson_notes || []) as SalespersonNote[];
    const noteToDelete = existingNotes.find((n) => n.id === noteId);

    // Only the creator can delete their notes
    if (noteToDelete && noteToDelete.created_by !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own notes' },
        { status: 403 }
      );
    }

    const updatedNotes = existingNotes.filter((n) => n.id !== noteId);

    const { error: updateError } = await supabase
      .from('relationship_intelligence')
      .update({
        salesperson_notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ri.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting note:', err);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
