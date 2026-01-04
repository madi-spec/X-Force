'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, X, Trash2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  level?: string;
}

interface TeamManagementProps {
  users: User[];
  currentUserId: string;
  isAdmin?: boolean;
}

const roleOptions = [
  { id: 'rep', label: 'Sales Rep' },
  { id: 'manager', label: 'Manager' },
  { id: 'admin', label: 'Admin' },
];

const teamOptions = [
  { id: 'voice', label: 'Voice' },
  { id: 'xrai', label: 'X-RAI' },
];

const levelOptions = [
  { id: 'l1_foundation', label: 'L1 - Foundation' },
  { id: 'l2_established', label: 'L2 - Established' },
  { id: 'l3_senior', label: 'L3 - Senior' },
];

export function TeamManagement({ users, currentUserId, isAdmin = false }: TeamManagementProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add user form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'rep',
    team: 'voice',
  });

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'rep',
    team: 'voice',
    level: 'l1_foundation',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Check if email already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.email)
        .single();

      if (existing) {
        setError('A user with this email already exists');
        setLoading(false);
        return;
      }

      // Insert new user (without auth_id - they'll link it when they sign up)
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          team: formData.team,
          level: 'l1_foundation',
          hire_date: new Date().toISOString().split('T')[0],
        });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      setIsModalOpen(false);
      setFormData({ name: '', email: '', role: 'rep', team: 'voice' });
      router.refresh();
    } catch (err) {
      setError('Failed to add team member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (userId === currentUserId) {
      alert('You cannot remove yourself');
      return;
    }

    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        console.error('Failed to remove user:', deleteError);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Failed to remove user:', err);
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team,
      level: user.level || 'l1_foundation',
    });
    setEditError(null);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editFormData.name || !editFormData.email) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const supabase = createClient();

      // Check if email changed and already exists for another user
      if (editFormData.email !== editingUser.email) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', editFormData.email)
          .neq('id', editingUser.id)
          .single();

        if (existing) {
          setEditError('A user with this email already exists');
          setEditLoading(false);
          return;
        }
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: editFormData.name,
          email: editFormData.email,
          role: editFormData.role,
          team: editFormData.team,
          level: editFormData.level,
        })
        .eq('id', editingUser.id);

      if (updateError) {
        setEditError(updateError.message);
        setEditLoading(false);
        return;
      }

      setEditingUser(null);
      router.refresh();
    } catch (err) {
      setEditError('Failed to update team member');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add Member
        </button>
      </div>

      <div className="space-y-3">
        {users.map(user => (
          <div
            key={user.id}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-xs text-gray-500">(You)</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <span className={cn(
                  'inline-flex px-2 py-0.5 text-xs font-medium rounded-full',
                  user.role === 'admin' && 'bg-purple-100 text-purple-700',
                  user.role === 'manager' && 'bg-blue-100 text-blue-700',
                  user.role === 'rep' && 'bg-gray-100 text-gray-700'
                )}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
                <p className="text-xs text-gray-500 mt-0.5 uppercase">{user.team}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleOpenEdit(user)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit team member"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {user.id !== currentUserId && (
                <button
                  onClick={() => handleRemoveUser(user.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove team member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No team members found</p>
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

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="john@company.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roleOptions.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team
                  </label>
                  <select
                    name="team"
                    value={formData.team}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {teamOptions.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name || !formData.email}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Team Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Member Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Team Member</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={editFormData.role}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roleOptions.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team
                  </label>
                  <select
                    name="team"
                    value={editFormData.team}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {teamOptions.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience Level
                </label>
                <select
                  name="level"
                  value={editFormData.level}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {levelOptions.map(level => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading || !editFormData.name || !editFormData.email}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
