/**
 * Get Context for Command Center Item
 *
 * GET /api/command-center/[itemId]/context
 *
 * Returns all context for a command center item:
 * - Relationship notes added by salespeople
 * - Current AI analysis
 * - Reanalysis history
 * - Full relationship context
 *
 * NOTE: This endpoint can be enhanced to use buildFullRelationshipContext
 * from contextFirstPipeline for richer context with formattedForAI output.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
// Future: Use buildFullRelationshipContext from contextFirstPipeline for enhanced context
// import { buildFullRelationshipContext } from '@/lib/intelligence/contextFirstPipeline';

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

interface RelationshipNote {
  id: string;
  note: string;
  context_type: 'strategy' | 'insight' | 'warning' | 'general';
  added_at: string;
  added_by_name: string | null;
  linked_source_type: string | null;
}

interface ContextResponse {
  item: {
    id: string;
    tier: number;
    tier_trigger: string | null;
    why_now: string | null;
    context_brief: string | null;
    suggested_actions: unknown[] | null;
    email_draft: unknown | null;
    reanalyzed_at: string | null;
    reanalyzed_with_context: string | null;
  };
  contact: {
    id: string;
    name: string;
    email: string;
    title: string | null;
  } | null;
  company: {
    id: string;
    name: string;
  } | null;
  notes: RelationshipNote[];
  relationshipSummary: string | null;
  recentInteractions: Array<{
    type: string;
    date: string;
    summary: string;
  }>;
  openCommitments: {
    ours: Array<{ commitment: string; due_date: string | null }>;
    theirs: Array<{ commitment: string; expected_by: string | null }>;
  };
  signals: {
    buying_signals: Array<{ signal: string; strength: string }>;
    concerns: Array<{ concern: string; severity: string; resolved: boolean }>;
  };
}

// ============================================
// GET - Get all context for an item
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
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

    const { itemId } = await params;
    const supabase = createAdminClient();

    // Get the command center item with related data
    const { data: item, error: itemError } = await supabase
      .from('command_center_items')
      .select(`
        id, tier, tier_trigger, why_now, context_brief,
        suggested_actions, email_draft, reanalyzed_at, reanalyzed_with_context,
        contact_id, company_id, source, source_id,
        contact:contacts(id, name, email, title),
        company:companies(id, name)
      `)
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Get relationship notes for this contact/company
    let notes: RelationshipNote[] = [];
    if (item.contact_id || item.company_id) {
      let query = supabase
        .from('relationship_notes')
        .select(`
          id, note, context_type, added_at, linked_source_type,
          added_by_user:users!relationship_notes_added_by_fkey(name)
        `)
        .order('added_at', { ascending: false })
        .limit(20);

      if (item.contact_id) {
        query = query.eq('contact_id', item.contact_id);
      } else if (item.company_id) {
        query = query.eq('company_id', item.company_id);
      }

      const { data: notesData } = await query;

      if (notesData) {
        notes = notesData.map((n) => {
          // Handle joined user data (could be array or object)
          const userObj = Array.isArray(n.added_by_user)
            ? n.added_by_user[0]
            : n.added_by_user;
          return {
            id: n.id,
            note: n.note,
            context_type: n.context_type || 'general',
            added_at: n.added_at,
            added_by_name: userObj?.name || null,
            linked_source_type: n.linked_source_type,
          };
        });
      }
    }

    // Get relationship intelligence
    let relationshipSummary: string | null = null;
    let recentInteractions: Array<{ type: string; date: string; summary: string }> = [];
    let openCommitments = { ours: [] as any[], theirs: [] as any[] };
    let signals = { buying_signals: [] as any[], concerns: [] as any[] };

    if (item.contact_id || item.company_id) {
      let riQuery = supabase
        .from('relationship_intelligence')
        .select('relationship_summary, interactions, open_commitments, signals');

      if (item.contact_id) {
        riQuery = riQuery.eq('contact_id', item.contact_id);
      } else if (item.company_id) {
        riQuery = riQuery.eq('company_id', item.company_id);
      }

      const { data: ri } = await riQuery.single();

      if (ri) {
        relationshipSummary = ri.relationship_summary;

        // Get last 5 interactions
        const interactions = (ri.interactions as any[]) || [];
        recentInteractions = interactions.slice(-5).reverse().map((int) => ({
          type: int.type,
          date: int.date,
          summary: int.summary || '',
        }));

        // Get open commitments
        const commitments = ri.open_commitments as any;
        if (commitments) {
          openCommitments.ours = (commitments.ours || [])
            .filter((c: any) => c.status === 'pending')
            .slice(0, 5);
          openCommitments.theirs = (commitments.theirs || [])
            .filter((c: any) => c.status === 'pending')
            .slice(0, 5);
        }

        // Get signals
        const signalsData = ri.signals as any;
        if (signalsData) {
          signals.buying_signals = (signalsData.buying_signals || []).slice(-5);
          signals.concerns = (signalsData.concerns || []).slice(-5);
        }
      }
    }

    const response: ContextResponse = {
      item: {
        id: item.id,
        tier: item.tier,
        tier_trigger: item.tier_trigger,
        why_now: item.why_now,
        context_brief: item.context_brief,
        suggested_actions: item.suggested_actions as unknown[] | null,
        email_draft: item.email_draft,
        reanalyzed_at: item.reanalyzed_at,
        reanalyzed_with_context: item.reanalyzed_with_context,
      },
      contact: (Array.isArray(item.contact) ? item.contact[0] : item.contact) as ContextResponse['contact'],
      company: (Array.isArray(item.company) ? item.company[0] : item.company) as ContextResponse['company'],
      notes,
      relationshipSummary,
      recentInteractions,
      openCommitments,
      signals,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GetContext] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
