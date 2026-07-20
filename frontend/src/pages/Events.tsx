import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Calendar, Gift, Heart, Activity } from 'lucide-react';
import { eventService } from '../services/event.service';
import { FamilyEvent } from '../types';
import EventCreateModal from '../components/events/EventCreateModal';

const eventIcons: Record<string, React.ElementType> = {
  birthday: Gift,
  anniversary: Heart,
  surgery: Activity,
  custom: Calendar,
};

const eventColors: Record<string, string> = {
  birthday: 'bg-pink-100 text-pink-700',
  anniversary: 'bg-red-100 text-red-700',
  surgery: 'bg-blue-100 text-blue-700',
  custom: 'bg-gray-100 text-gray-700',
};

export default function Events() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // A full year so annual events (birthdays, anniversaries) are always visible
  const { data, isLoading } = useQuery({
    queryKey: ['events', { days: 365 }],
    queryFn: () => eventService.getEvents({ days: 365 }),
  });

  const groupedEvents = groupEventsByMonth(data?.events || []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Events</h1>
          <p className="text-gray-600">
            {data?.events.length || 0} upcoming events
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-5 h-5 mr-2" />
          Add Event
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : data?.events.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No upcoming events
          </h2>
          <p className="text-gray-600 mb-4">
            Add birthdays, anniversaries, and important dates to never forget!
          </p>
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            Add First Event
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([month, events]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {month}
              </h2>
              <div className="space-y-3">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EventCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

function EventCard({ event }: { event: FamilyEvent }) {
  const Icon = eventIcons[event.type] || Calendar;
  const colorClass = eventColors[event.type] || eventColors.custom;

  return (
    <div className="card p-4">
      <div className="flex items-start space-x-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}
        >
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-gray-900">{event.title}</h3>
              <p className="text-sm text-gray-500">
                {new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                event.daysUntil === 0
                  ? 'bg-primary-100 text-primary-700'
                  : event.daysUntil === 1
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {event.daysUntil === 0
                ? 'Today!'
                : event.daysUntil === 1
                ? 'Tomorrow'
                : `${event.daysUntil} days`}
            </span>
          </div>

          {event.description && (
            <p className="text-sm text-gray-600 mt-2">{event.description}</p>
          )}

          {event.involves.length > 0 && (
            <div className="flex items-center mt-2 space-x-2">
              <span className="text-sm text-gray-500">Involves:</span>
              <div className="flex -space-x-2">
                {event.involves.map((person) => (
                  <div
                    key={person.id}
                    className="w-6 h-6 bg-primary-100 rounded-full border-2 border-white flex items-center justify-center"
                    title={person.name}
                  >
                    <span className="text-xs text-primary-700">
                      {person.name.charAt(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function groupEventsByMonth(events: FamilyEvent[]): Record<string, FamilyEvent[]> {
  return events.reduce((acc, event) => {
    const date = new Date(event.date);
    const monthYear = date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(event);
    return acc;
  }, {} as Record<string, FamilyEvent[]>);
}
