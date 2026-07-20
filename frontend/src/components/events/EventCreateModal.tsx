import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2, Gift, Heart, Activity, Calendar } from 'lucide-react';
import Modal from '../ui/Modal';
import { eventService } from '../../services/event.service';
import { familyService } from '../../services/family.service';
import { FamilyEvent } from '../../types';

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const eventTypes: { value: FamilyEvent['type']; label: string; Icon: React.ElementType }[] = [
  { value: 'birthday', label: 'Birthday', Icon: Gift },
  { value: 'anniversary', label: 'Anniversary', Icon: Heart },
  { value: 'surgery', label: 'Medical', Icon: Activity },
  { value: 'custom', label: 'Custom', Icon: Calendar },
];

export default function EventCreateModal({ isOpen, onClose }: EventCreateModalProps) {
  const [type, setType] = useState<FamilyEvent['type']>('birthday');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: membersData } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => familyService.getMembers(),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: eventService.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      resetForm();
      onClose();
    },
  });

  const resetForm = () => {
    setType('birthday');
    setTitle('');
    setDescription('');
    setDate('');
    setRecurring(false);
    setSelectedMembers([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    createMutation.mutate({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      recurring,
      involves: selectedMembers,
    });
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Family Event" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {eventTypes.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center ${
                  type === value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${type === value ? 'text-primary-600' : 'text-gray-500'}`} />
                <span className={`text-xs ${type === value ? 'text-primary-700' : 'text-gray-600'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Mom's Birthday"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any additional details..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="recurring"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="mr-2 rounded text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="recurring" className="text-sm text-gray-700">
            Repeat every year
          </label>
        </div>

        {membersData?.members && membersData.members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Family Members Involved
            </label>
            <div className="flex flex-wrap gap-2">
              {membersData.members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedMembers.includes(member.id)
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {createMutation.error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Failed to create event. Please try again.
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
            disabled={!title.trim() || !date || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Add Event'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
