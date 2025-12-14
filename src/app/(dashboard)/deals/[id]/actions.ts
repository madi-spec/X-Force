'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function addTeamMember(
  dealId: string,
  userId: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get current user for authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  if (role === 'owner') {
    // Transfer ownership - update the deal's owner_id
    const { error: updateError } = await supabase
      .from('deals')
      .update({ owner_id: userId })
      .eq('id', dealId);

    if (updateError) {
      console.error('Transfer ownership error:', updateError);
      return { success: false, error: updateError.message };
    }
  } else {
    // Check if this user is already a collaborator
    const { data: existing } = await supabase
      .from('deal_collaborators')
      .select('id')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing collaborator role
      const { error: updateError } = await supabase
        .from('deal_collaborators')
        .update({ role })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Update collaborator error:', updateError);
        return { success: false, error: updateError.message };
      }
    } else {
      // Insert new collaborator
      const { error: insertError } = await supabase
        .from('deal_collaborators')
        .insert({
          deal_id: dealId,
          user_id: userId,
          role,
        });

      if (insertError) {
        console.error('Insert collaborator error:', insertError);
        return { success: false, error: insertError.message };
      }
    }
  }

  // Revalidate the deal page to show updated data
  revalidatePath(`/deals/${dealId}`);

  return { success: true };
}

export async function removeTeamMember(
  dealId: string,
  collaboratorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get current user for authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error: deleteError } = await supabase
    .from('deal_collaborators')
    .delete()
    .eq('id', collaboratorId);

  if (deleteError) {
    console.error('Delete collaborator error:', deleteError);
    return { success: false, error: deleteError.message };
  }

  // Revalidate the deal page to show updated data
  revalidatePath(`/deals/${dealId}`);

  return { success: true };
}
