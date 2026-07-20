import api from './api';
import { Story, CreateStoryInput } from '../types';

interface StoriesResponse {
  stories: Story[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

function normalizeStory(story: Story): Story {
  return {
    ...story,
    author: story.author ?? {
      id: '',
      name: 'Unknown author',
    },
    topics: story.topics ?? [],
    mentions: story.mentions ?? [],
  };
}

export const storyService = {
  async getStories(params?: {
    page?: number;
    limit?: number;
    author?: string;
  }): Promise<StoriesResponse> {
    const response = await api.get('/stories', { params });
    return {
      stories: (response.data.stories ?? []).map(normalizeStory),
      pagination: response.data.pagination ?? {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        total: 0,
      },
    };
  },

  async getStory(id: string): Promise<Story> {
    const response = await api.get(`/stories/${id}`);
    return normalizeStory(response.data);
  },

  async createStory(data: CreateStoryInput): Promise<Story> {
    const response = await api.post('/stories', data);
    return normalizeStory(response.data);
  },

  async deleteStory(id: string): Promise<void> {
    await api.delete(`/stories/${id}`);
  },

  async reactToStory(id: string, emoji: string): Promise<void> {
    await api.post(`/stories/${id}/react`, { emoji });
  },
};
