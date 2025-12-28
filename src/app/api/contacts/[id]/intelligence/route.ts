import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { RelationshipFact } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Fetch contact with relationship intelligence
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch contact with all fields
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Fetch meeting mentions for this contact
    const { data: mentions } = await supabase
      .from('contact_meeting_mentions')
      .select(`
        *,
        transcription:meeting_transcriptions(
          id,
          title,
          meeting_date,
          duration_minutes
        )
      `)
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      contact,
      relationshipFacts: contact.relationship_facts || [],
      communicationStyle: contact.communication_style || null,
      meetingMentions: mentions || [],
      aiDetectedAt: contact.ai_detected_at,
      aiDetectionSource: contact.ai_detection_source,
      aiConfidence: contact.ai_confidence,
    });
  } catch (error) {
    console.error('Error fetching contact intelligence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add a manual relationship fact
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, fact } = body;

    if (!type || !fact) {
      return NextResponse.json(
        { error: 'Type and fact are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['personal', 'preference', 'family', 'interest', 'communication', 'concern'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch current contact
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('relationship_facts')
      .eq('id', id)
      .single();

    if (fetchError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Create new fact
    const newFact: RelationshipFact = {
      type,
      fact,
      source: 'Manual entry',
      detected_at: new Date().toISOString(),
      confidence: 1.0,
    };

    // Add to existing facts
    const existingFacts = (contact.relationship_facts || []) as RelationshipFact[];
    const updatedFacts = [...existingFacts, newFact];

    // Update contact
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update({ relationship_facts: updatedFacts })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating contact:', updateError);
      return NextResponse.json({ error: 'Failed to add fact' }, { status: 500 });
    }

    return NextResponse.json({
      contact: updatedContact,
      addedFact: newFact,
    });
  } catch (error) {
    console.error('Error adding relationship fact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a relationship fact by index
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const factIndex = parseInt(searchParams.get('index') || '-1');

    if (factIndex < 0) {
      return NextResponse.json(
        { error: 'Fact index is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current contact
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('relationship_facts')
      .eq('id', id)
      .single();

    if (fetchError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const existingFacts = (contact.relationship_facts || []) as RelationshipFact[];

    if (factIndex >= existingFacts.length) {
      return NextResponse.json({ error: 'Fact index out of range' }, { status: 400 });
    }

    // Remove the fact at index
    const updatedFacts = existingFacts.filter((_, i) => i !== factIndex);

    // Update contact
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ relationship_facts: updatedFacts })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating contact:', updateError);
      return NextResponse.json({ error: 'Failed to remove fact' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing relationship fact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
