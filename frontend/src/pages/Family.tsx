import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { familyService, AddMemberPayload } from '../services/family.service';
import { useAuthStore } from '../store/authStore';
import { Plus, Users, UserX, Send } from 'lucide-react';
import FamilyTreeVisualization from '../components/family/FamilyTreeVisualization';
import InviteMemberModal from '../components/family/InviteMemberModal';

export default function Family() {
  const { user, updateToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { data: familyTree, isLoading } = useQuery({
    queryKey: ['familyTree'],
    queryFn: familyService.getFamilyTree,
    enabled: !!user?.familyId,
  });

  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn: familyService.getMembers,
    enabled: !!user?.familyId,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => familyService.createFamily(name),
    onSuccess: (data) => {
      updateToken(data.token, data.id);
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['familyTree'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setFamilyName('');
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: AddMemberPayload) => familyService.addMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['familyTree'] });
      setIsInviteModalOpen(false);
    },
  });

  const resendMutation = useMutation({
    mutationFn: (placeholderId: string) => familyService.resendInvite(placeholderId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // No family yet — show create form
  if (!user?.familyId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Your Family</h1>
          <p className="text-gray-500 mt-2">
            Start by giving your family a name. You can add members after.
          </p>
        </div>
        <div className="card p-6 text-left space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family Name
            </label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Your family name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && familyName.trim().length >= 2) {
                  createMutation.mutate(familyName.trim());
                }
              }}
            />
          </div>
          <button
            onClick={() => createMutation.mutate(familyName.trim())}
            disabled={familyName.trim().length < 2 || createMutation.isPending}
            className="btn-primary w-full"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Family'}
          </button>
          {createMutation.isError && (
            <p className="text-red-500 text-sm">Failed to create family. Please try again.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Tree</h1>
          <p className="text-gray-600">
            {members?.members.length || 0} family members
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsInviteModalOpen(true)}>
          <Plus className="w-5 h-5 mr-2" />
          Add Member
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Family Tree</h2>
          <p className="text-sm text-gray-500">
            {familyTree?.nodes.length || 0} members, {familyTree?.edges.length || 0} connections
          </p>
        </div>
        {familyTree && <FamilyTreeVisualization tree={familyTree} />}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Family Members</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members?.members.map((member) => (
            <div key={member.id} className="card p-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-xl font-semibold">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  {member.isRegistered === false && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border border-gray-200">
                      <UserX className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-900 truncate">{member.name}</p>
                    {member.isRegistered === false && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">· not joined</span>
                    )}
                  </div>
                  {member.nickname && (
                    <p className="text-sm text-gray-500">"{member.nickname}"</p>
                  )}
                  {member.birthDate && (
                    <p className="text-sm text-gray-500">
                      Born: {new Date(member.birthDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {member.isRegistered === false && member.inviteEmail && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500 truncate">{member.inviteEmail}</p>
                  <button
                    onClick={() => resendMutation.mutate(member.id)}
                    disabled={resendMutation.isPending}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 ml-2 shrink-0"
                  >
                    <Send className="w-3 h-3" />
                    Resend invite
                  </button>
                </div>
              )}

              {member.preferences && Object.keys(member.preferences).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Quick facts:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(member.preferences).slice(0, 3).map(([key, value]) => (
                      <span key={key} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <InviteMemberModal
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        members={members?.members ?? []}
        onInvite={(data) => addMutation.mutate(data)}
        isPending={addMutation.isPending}
        error={addMutation.isError ? 'Failed to add member. Please try again.' : null}
      />
    </div>
  );
}
