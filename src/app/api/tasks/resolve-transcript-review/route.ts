import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createEntitiesFromTranscript, type ExtractedEntityData } from '@/lib/ai/transcriptEntityMatcher';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { taskId, transcriptionId, action, companyId, dealId, extractedData } = body;

    if (!taskId || !transcriptionId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, transcriptionId, action' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    if (action === 'match') {
      // Match to existing company/deal
      if (!companyId) {
        return NextResponse.json(
          { error: 'companyId is required for match action' },
          { status: 400 }
        );
      }

      // Update transcription with company/deal
      const updateData: Record<string, unknown> = {
        company_id: companyId,
        match_confidence: 1.0, // Manually matched = 100% confidence
      };

      // Handle deal selection
      if (dealId === 'new') {
        // Create a new deal for this company
        const extractedDataFromMeta = await getExtractedDataFromTranscription(adminSupabase, transcriptionId);

        if (extractedDataFromMeta?.deal) {
          const { data: newDeal, error: dealError } = await adminSupabase
            .from('deals')
            .insert({
              company_id: companyId,
              owner_id: profile.id,
              name: extractedDataFromMeta.deal.suggestedName || 'New Deal',
              stage: 'new_lead',
              deal_type: 'new_business',
              sales_team: extractedDataFromMeta.deal.salesTeam || 'voice_inside',
              estimated_value: extractedDataFromMeta.deal.estimatedValue || 10000,
              quoted_products: extractedDataFromMeta.deal.productInterests || [],
            })
            .select('id, name')
            .single();

          if (!dealError && newDeal) {
            updateData.deal_id = newDeal.id;

            // Create activity for the meeting
            await adminSupabase.from('activities').insert({
              deal_id: newDeal.id,
              company_id: companyId,
              user_id: profile.id,
              type: 'meeting_held',
              subject: 'Meeting (from Fireflies transcript)',
              body: 'Meeting transcript linked to this deal.',
              occurred_at: new Date().toISOString(),
            });
          }
        }
      } else if (dealId) {
        updateData.deal_id = dealId;

        // Create activity for the existing deal
        await adminSupabase.from('activities').insert({
          deal_id: dealId,
          company_id: companyId,
          user_id: profile.id,
          type: 'meeting_held',
          subject: 'Meeting (from Fireflies transcript)',
          body: 'Meeting transcript linked to this deal.',
          occurred_at: new Date().toISOString(),
        });
      }

      const { error: updateError } = await adminSupabase
        .from('meeting_transcriptions')
        .update(updateData)
        .eq('id', transcriptionId);

      if (updateError) {
        console.error('[Resolve Transcript Review] Failed to update transcription:', updateError);
        return NextResponse.json(
          { error: 'Failed to update transcription' },
          { status: 500 }
        );
      }

      // Mark task as completed
      await adminSupabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', taskId);

      return NextResponse.json({
        success: true,
        action: 'matched',
        companyId,
        dealId: updateData.deal_id || dealId,
      });

    } else if (action === 'create') {
      // Create new company, contacts, and deal
      if (!extractedData) {
        // Try to get from transcription metadata
        const dataFromMeta = await getExtractedDataFromTranscription(adminSupabase, transcriptionId);
        if (!dataFromMeta) {
          return NextResponse.json(
            { error: 'No extracted data available for create action' },
            { status: 400 }
          );
        }
        body.extractedData = dataFromMeta;
      }

      const result = await createEntitiesFromTranscript(
        extractedData || body.extractedData,
        profile.id,
        transcriptionId
      );

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to create entities' },
          { status: 500 }
        );
      }

      // Update transcription with new company/deal
      await adminSupabase
        .from('meeting_transcriptions')
        .update({
          company_id: result.companyId,
          deal_id: result.dealId,
          match_confidence: 1.0,
        })
        .eq('id', transcriptionId);

      // Mark task as completed
      await adminSupabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', taskId);

      return NextResponse.json({
        success: true,
        action: 'created',
        companyId: result.companyId,
        companyName: result.companyName,
        dealId: result.dealId,
        dealName: result.dealName,
        contactCount: result.contactIds.length,
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "match" or "create"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[Resolve Transcript Review] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getExtractedDataFromTranscription(
  supabase: ReturnType<typeof createAdminClient>,
  transcriptionId: string
): Promise<ExtractedEntityData | null> {
  const { data } = await supabase
    .from('meeting_transcriptions')
    .select('external_metadata')
    .eq('id', transcriptionId)
    .single();

  if (data?.external_metadata?.extracted_entity_data) {
    return data.external_metadata.extracted_entity_data as ExtractedEntityData;
  }

  return null;
}
