import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { storyService } from '../../services/story.service';
import { useAuthStore } from '../../store/authStore';

interface StoryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StoryCreateModal({ isOpen, onClose }: StoryCreateModalProps) {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'specific'>('public');
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: storyService.createStory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      setContent('');
      setVisibility('public');
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user?.id) return;

    createMutation.mutate({
      content: content.trim(),
      authorId: user.id,
      visibility: { type: visibility },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share a Family Story" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Your Story
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a memory, a funny moment, or an important family event..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            AI will automatically extract people, facts, and events from your story.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visibility
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                className="mr-2 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Whole Family</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="specific"
                checked={visibility === 'specific'}
                onChange={() => setVisibility('specific')}
                className="mr-2 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Specific Members</span>
            </label>
          </div>
        </div>

        {createMutation.error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Failed to create story. Please try again.
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={createMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!content.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Share Story'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
