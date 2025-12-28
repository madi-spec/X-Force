import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Types for corrections
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

// POST: Submit a correction
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
    const { field, original_value, corrected_value, reason } = body;

    if (!field || corrected_value === undefined) {
      return NextResponse.json(
        { error: 'Field and corrected value are required' },
        { status: 400 }
      );
    }

    // Get or create relationship intelligence record
    let { data: ri, error: riError } = await supabase
      .from('relationship_intelligence')
      .select('id, salesperson_corrections, context')
      .eq('company_id', companyId)
      .maybeSingle();

    if (riError && riError.code !== 'PGRST116') {
      throw riError;
    }

    const newCorrection: SalespersonCorrection = {
      id: crypto.randomUUID(),
      field,
      original_value,
      corrected_value,
      reason: reason || undefined,
      created_at: new Date().toISOString(),
      created_by: user.id,
      created_by_name: profile?.name || user.email || 'Unknown',
      status: 'applied', // Auto-apply corrections for now
    };

    const existingCorrections = (ri?.salesperson_corrections || []) as SalespersonCorrection[];
    const updatedCorrections = [...existingCorrections, newCorrection];

    // Apply the correction to the context if it's a context field
    let updatedContext = ri?.context || {};
    if (field.startsWith('context.')) {
      const contextPath = field.replace('context.', '').split('.');
      let current = updatedContext as Record<string, any>;
      for (let i = 0; i < contextPath.length - 1; i++) {
        if (!current[contextPath[i]]) {
          current[contextPath[i]] = {};
        }
        current = current[contextPath[i]];
      }
      current[contextPath[contextPath.length - 1]] = corrected_value;
    }

    if (ri) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('relationship_intelligence')
        .update({
          salesperson_corrections: updatedCorrections,
          context: updatedContext,
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
          salesperson_corrections: updatedCorrections,
          context: updatedContext,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, correction: newCorrection });
  } catch (err) {
    console.error('Error adding correction:', err);
    return NextResponse.json(
      { error: 'Failed to add correction' },
      { status: 500 }
    );
  }
}

// PATCH: Update correction status (approve/reject)
export async function PATCH(
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

    const body = await request.json();
    const { correctionId, status } = body;

    if (!correctionId || !['applied', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Correction ID and valid status are required' },
        { status: 400 }
      );
    }

    // Get existing corrections
    const { data: ri, error: riError } = await supabase
      .from('relationship_intelligence')
      .select('id, salesperson_corrections, context')
      .eq('company_id', companyId)
      .single();

    if (riError) throw riError;

    const existingCorrections = (ri?.salesperson_corrections || []) as SalespersonCorrection[];
    const correctionIndex = existingCorrections.findIndex((c) => c.id === correctionId);

    if (correctionIndex === -1) {
      return NextResponse.json(
        { error: 'Correction not found' },
        { status: 404 }
      );
    }

    existingCorrections[correctionIndex].status = status;

    // If applying, update the context
    let updatedContext = ri?.context || {};
    if (status === 'applied') {
      const correction = existingCorrections[correctionIndex];
      if (correction.field.startsWith('context.')) {
        const contextPath = correction.field.replace('context.', '').split('.');
        let current = updatedContext as Record<string, any>;
        for (let i = 0; i < contextPath.length - 1; i++) {
          if (!current[contextPath[i]]) {
            current[contextPath[i]] = {};
          }
          current = current[contextPath[i]];
        }
        current[contextPath[contextPath.length - 1]] = correction.corrected_value;
      }
    }

    const { error: updateError } = await supabase
      .from('relationship_intelligence')
      .update({
        salesperson_corrections: existingCorrections,
        context: updatedContext,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ri.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating correction:', err);
    return NextResponse.json(
      { error: 'Failed to update correction' },
      { status: 500 }
    );
  }
}
