import { formatDistanceToNow } from 'date-fns';
import { Story } from '../../types';

interface Props {
  story: Story;
  onClick?: () => void;
}

const moodEmoji: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  nostalgic: '🥹',
  funny: '😄',
  serious: '🤔',
};

export default function StoryCard({ story, onClick }: Props) {
  const authorName = story.author?.name || 'Unknown author';
  const authorInitial = authorName.charAt(0).toUpperCase() || '?';
  const createdAt = story.createdAt ? new Date(story.createdAt) : null;

  return (
    <div
      className="card p-4 hover:shadow-md transition cursor-pointer"
      onClick={onClick}
    >
      {/* Author */}
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-700 font-medium">
            {authorInitial}
          </span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{authorName}</p>
          <p className="text-sm text-gray-500">
            {createdAt && !Number.isNaN(createdAt.getTime())
              ? formatDistanceToNow(createdAt, { addSuffix: true })
              : 'Unknown date'}
          </p>
        </div>
      </div>

      {/* Content */}
      <p className="text-gray-700 line-clamp-3 mb-3">{story.content}</p>

      {/* Mood & Topics */}
      <div className="flex items-center space-x-2 mb-3">
        {story.mood && (
          <span className="text-lg" title={story.mood}>
            {moodEmoji[story.mood] || '📝'}
          </span>
        )}
        {(story.topics ?? []).slice(0, 3).map((topic) => (
          <span
            key={topic}
            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
          >
            {topic}
          </span>
        ))}
      </div>

      {/* Mentions */}
      {(story.mentions ?? []).length > 0 && (
        <p className="text-sm text-gray-500">
          Mentions: {(story.mentions ?? []).map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}
