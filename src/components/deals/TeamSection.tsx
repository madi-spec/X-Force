'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserPlus, X, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { SalesTeam } from '@/types';

interface TeamMember {
  user: {
    id: string;
    name: string;
    email: string;
  };
  role: string;
  collaborator_id?: string;
}

interface TeamSectionProps {
  dealId: string;
  salesTeam?: SalesTeam | null;
  teamList: TeamMember[];
  availableUsers: Array<{ id: string; name: string; email: string }>;
}

const teamConfig: Record<SalesTeam, { label: string }> = {
  voice_outside: { label: 'Voice Outside' },
  voice_inside: { label: 'Voice Inside' },
  xrai: { label: 'X-RAI' },
};

const collaboratorRoles = [
  { id: 'owner', label: 'Owner (Transfer ownership)', isOwner: true },
  { id: 'collaborator', label: 'Collaborator' },
  { id: 'informed', label: 'Informed' },
  { id: 'approver', label: 'Approver' },
];

export function TeamSection({ dealId, salesTeam, teamList, availableUsers }: TeamSectionProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('collaborator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For adding, we can pick from all users (they might replace owner or be added as collaborator)
  // Filter out users who are already collaborators (but allow selecting current owner to show transfer option)
  const collaboratorUserIds = teamList.filter(m => m.role !== 'owner').map(m => m.user.id);
  const filteredUsers = availableUsers.filter(u => !collaboratorUserIds.includes(u.id));

  const handleAddTeamMember = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      if (selectedRole === 'owner') {
        // Transfer ownership - update the deal's owner_id
        const { error: updateError } = await supabase
          .from('deals')
          .update({ owner_id: selectedUserId })
          .eq('id', dealId);

        if (updateError) {
          setError(updateError.message);
          setLoading(false);
          return;
        }
      } else {
        // Add as collaborator
        // First check if this user is already a collaborator
        const { data: existing } = await supabase
          .from('deal_collaborators')
          .select('id')
          .eq('deal_id', dealId)
          .eq('user_id', selectedUserId)
          .single();

        if (existing) {
          // Update existing collaborator role
          const { error: updateError } = await supabase
            .from('deal_collaborators')
            .update({ role: selectedRole })
            .eq('id', existing.id);

          if (updateError) {
            setError(updateError.message);
            setLoading(false);
            return;
          }
        } else {
          // Insert new collaborator
          const { error: insertError } = await supabase
            .from('deal_collaborators')
            .insert({
              deal_id: dealId,
              user_id: selectedUserId,
              role: selectedRole,
            });

          if (insertError) {
            setError(insertError.message);
            setLoading(false);
            return;
          }
        }
      }

      setIsModalOpen(false);
      setSelectedUserId('');
      setSelectedRole('collaborator');
      router.refresh();
    } catch (err) {
      setError('Failed to update team');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!confirm('Remove this team member?')) return;

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase
        .from('deal_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (deleteError) {
        console.error('Failed to remove collaborator:', deleteError);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Team</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Person
        </button>
      </div>

      <div className="space-y-3">
        {teamList.map((member, idx) => (
          <div
            key={member.user.id + idx}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                member.role === 'owner' ? 'bg-amber-100' : 'bg-gray-100'
              )}>
                {member.role === 'owner' ? (
                  <Crown className="h-5 w-5 text-amber-600" />
                ) : (
                  <User className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{member.user.name}</p>
                <p className="text-sm text-gray-500 capitalize">
                  {member.role === 'owner' ? 'Owner' : member.role.replace('_', ' ')}
                  {member.role === 'owner' && salesTeam && teamConfig[salesTeam] && (
                    <span className="ml-1">({teamConfig[salesTeam].label})</span>
                  )}
                </p>
              </div>
            </div>
            {member.role !== 'owner' && member.collaborator_id && (
              <button
                onClick={() => handleRemoveCollaborator(member.collaborator_id!)}
                className="text-sm text-gray-400 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {teamList.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No team members assigned</p>
        )}
      </div>

      {/* Add Team Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Team Member</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Person
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a team member...</option>
                  {filteredUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No more users available. Add team members in Settings.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {collaboratorRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
                {selectedRole === 'owner' && (
                  <p className="text-sm text-amber-600 mt-1">
                    This will transfer deal ownership to the selected person.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTeamMember}
                disabled={loading || !selectedUserId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : selectedRole === 'owner' ? 'Transfer Ownership' : 'Add to Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
