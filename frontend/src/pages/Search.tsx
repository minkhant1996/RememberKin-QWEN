import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, BookOpen, Brain, Loader2 } from 'lucide-react';
import { searchService } from '../services/search.service';
import { storyService } from '../services/story.service';
import { SearchResult, Story } from '../types';
import StoryDetailModal from '../components/stories/StoryDetailModal';

type FilterType = 'all' | 'story' | 'memory';

export default function Search() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  const handleResultClick = async (result: SearchResult) => {
    if (result.type !== 'story') return;
    try {
      const story = await storyService.getStory(result.id);
      setSelectedStory(story);
    } catch {
      // silently ignore — story may have been deleted or is inaccessible
    }
  };

  // Run searches arriving via the header search box (/search?q=...)
  useEffect(() => {
    const q = searchParams.get('q')?.trim() ?? '';
    if (q.length >= 2) {
      setQuery(q);
      setDebouncedQuery(q);
    }
  }, [searchParams]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      setDebouncedQuery(query.trim());
    }
  };

  const filteredResults = data?.results.filter((result) => {
    if (filter === 'all') return true;
    return result.type === filter;
  }) || [];

  const storyCount = data?.results.filter(r => r.type === 'story').length || 0;
  const memoryCount = data?.results.filter(r => r.type === 'memory').length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Memories</h1>
        <p className="text-gray-600">
          Search through family stories and memories using AI-powered semantic search
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for anything... (e.g., 'grandma's cooking', 'summer vacation 2010')"
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {isFetching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 animate-spin" />
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Try semantic queries like "happy moments with family" or "important lessons learned"
        </p>
      </form>

      {debouncedQuery && data && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Found {data.results.length} results for "{debouncedQuery}"
            </p>
            <div className="flex space-x-2">
              <FilterButton
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                label={`All (${data.results.length})`}
              />
              <FilterButton
                active={filter === 'story'}
                onClick={() => setFilter('story')}
                label={`Stories (${storyCount})`}
                icon={BookOpen}
              />
              <FilterButton
                active={filter === 'memory'}
                onClick={() => setFilter('memory')}
                label={`Memories (${memoryCount})`}
                icon={Brain}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="card p-12 text-center">
              <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No results found
              </h2>
              <p className="text-gray-600">
                Try a different search term or broaden your query
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResults.map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  onClick={
                    result.type === 'story'
                      ? () => handleResultClick(result)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {!debouncedQuery && (
        <div className="card p-12 text-center">
          <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Start Searching
          </h2>
          <p className="text-gray-600 mb-6">
            Enter at least 2 characters to search through your family's stories and memories
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['birthday celebrations', 'cooking recipes', 'travel adventures', 'childhood memories'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  setDebouncedQuery(suggestion);
                }}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <StoryDetailModal
        story={selectedStory}
        isOpen={selectedStory !== null}
        onClose={() => setSelectedStory(null)}
      />
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-sm flex items-center transition-colors ${
        active
          ? 'bg-primary-100 text-primary-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {Icon && <Icon className="w-4 h-4 mr-1" />}
      {label}
    </button>
  );
}

function SearchResultCard({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick?: () => void;
}) {
  const Icon = result.type === 'story' ? BookOpen : Brain;
  const typeColor = result.type === 'story' ? 'text-blue-600 bg-blue-100' : 'text-purple-600 bg-purple-100';
  const relevancePercent = Math.round(result.relevance * 100);

  return (
    <div
      className={`card p-4 hover:shadow-md transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start space-x-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>
              {result.type === 'story' ? 'Story' : 'Memory'}
            </span>
            <span className="text-xs text-gray-500">
              {relevancePercent}% match
            </span>
          </div>

          {result.summary && (
            <p className="font-medium text-gray-900 mb-1">{result.summary}</p>
          )}

          <p className="text-sm text-gray-600 line-clamp-2">
            {result.content}
          </p>

          <div className="mt-2 flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-primary-600 h-1.5 rounded-full"
                style={{ width: `${relevancePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
