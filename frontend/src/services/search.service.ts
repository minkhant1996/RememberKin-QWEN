import api from './api';
import { SearchResult } from '../types';

interface SearchResponse {
  results: SearchResult[];
}

export const searchService = {
  async search(query: string, types?: ('stories' | 'memories')[]): Promise<SearchResponse> {
    const params: Record<string, string> = { q: query };
    if (types && types.length > 0) {
      params.types = types.join(',');
    }
    const response = await api.get('/search', { params });
    return response.data;
  },

  async searchStories(query: string): Promise<SearchResponse> {
    return this.search(query, ['stories']);
  },

  async searchMemories(query: string): Promise<SearchResponse> {
    return this.search(query, ['memories']);
  },
};
