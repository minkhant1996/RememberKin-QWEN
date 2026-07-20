import api from './api';
import { Family, FamilyTree, Person } from '../types';

export interface AddMemberPayload {
  name: string;
  nickname?: string;
  birthDate?: string;
  isDeceased?: boolean;
  relationship?: string;
  relatedTo?: string;
  email?: string;
}

export const familyService = {
  async getFamily(): Promise<Family | null> {
    const response = await api.get('/family');
    return response.data;
  },

  async createFamily(name: string): Promise<Family & { token: string }> {
    const response = await api.post('/family', { name });
    return response.data;
  },

  async getFamilyTree(): Promise<FamilyTree> {
    const response = await api.get('/family/tree');
    return response.data;
  },

  async getMembers(): Promise<{ members: Person[] }> {
    const response = await api.get('/members');
    return response.data;
  },

  async getMember(id: string): Promise<Person> {
    const response = await api.get(`/members/${id}`);
    return response.data;
  },

  async addMember(data: AddMemberPayload): Promise<{ member: Person; inviteSent: boolean }> {
    const response = await api.post('/family/invite', data);
    return response.data;
  },

  async claimInvite(
    inviteToken: string,
    action: 'accept' | 'decline'
  ): Promise<{ token?: string; familyId?: string; message: string }> {
    const response = await api.post('/family/invite/claim', { inviteToken, action });
    return response.data;
  },

  async resendInvite(placeholderId: string): Promise<void> {
    await api.post('/family/invite/resend', { placeholderId });
  },
};
