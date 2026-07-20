import api from './api';
import { FamilyEvent } from '../types';

interface CreateEventInput {
  type: FamilyEvent['type'];
  title: string;
  description?: string;
  date: string;
  recurring?: boolean;
  reminderDays?: number[];
  involves: string[];
}

export const eventService = {
  async getEvents(params?: {
    days?: number;
    type?: string;
  }): Promise<{ events: FamilyEvent[] }> {
    const response = await api.get('/events', { params });
    return response.data;
  },

  async createEvent(data: CreateEventInput): Promise<FamilyEvent> {
    const response = await api.post('/events', data);
    return response.data;
  },

  async updateEvent(id: string, data: Partial<CreateEventInput>): Promise<FamilyEvent> {
    const response = await api.put(`/events/${id}`, data);
    return response.data;
  },

  async deleteEvent(id: string): Promise<void> {
    await api.delete(`/events/${id}`);
  },
};
