import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { storyService } from '../services/story.service';
import { Story } from '../types';
import StoryCard from '../components/stories/StoryCard';
import StoryCreateModal from '../components/stories/StoryCreateModal';
import StoryDetailModal from '../components/stories/StoryDetailModal';

export default function Stories() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  // ?new=1 lets chat suggested-actions deep-link straight into story creation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(searchParams.get('new') === '1');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stories', { page }],
    queryFn: () => storyService.getStories({ page, limit: 10 }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Stories</h1>
          <p className="text-gray-600">
            {data?.pagination.total || 0} stories shared
          </p>
        </div>
        <div className="flex space-x-2">
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Add Story
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : isError ? (
        <div className="card p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Could not load stories
          </h2>
          <p className="text-gray-600">
            Make sure you've joined a family before viewing stories.
          </p>
        </div>
      ) : data?.stories.length === 0 ? (
        <div className="card p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No stories yet
          </h2>
          <p className="text-gray-600 mb-4">
            Start preserving your family memories by sharing the first story!
          </p>
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            Add Your First Story
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onClick={() => setSelectedStory(story)}
            />
          ))}

          {/* Pagination */}
          {data && data.pagination.total > data.pagination.limit && (
            <div className="flex justify-center space-x-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600">
                Page {page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.stories.length < data.pagination.limit}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      <StoryCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <StoryDetailModal
        story={selectedStory}
        isOpen={selectedStory !== null}
        onClose={() => setSelectedStory(null)}
      />
    </div>
  );
}
