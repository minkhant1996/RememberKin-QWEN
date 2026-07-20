import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Heart,
  MessageCircle,
  Sparkles,
  TreePine,
  Users,
  Wand2,
} from 'lucide-react';
import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { familyService } from '../services/family.service';
import { storyService } from '../services/story.service';
import { eventService } from '../services/event.service';
import { memoryDashboardService } from '../services/memory-dashboard.service';
import StoryCard from '../components/stories/StoryCard';

export default function Home() {
  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: familyService.getFamily,
  });

  const { data: storiesData } = useQuery({
    queryKey: ['stories', { limit: 3 }],
    queryFn: () => storyService.getStories({ limit: 3 }),
  });

  // Full year so annual events (birthdays, anniversaries) count — matches Events page
  const { data: eventsData } = useQuery({
    queryKey: ['events', { days: 365 }],
    queryFn: () => eventService.getEvents({ days: 365 }),
  });

  const { data: memoryStatsData } = useQuery({
    queryKey: ['memory-stats'],
    queryFn: memoryDashboardService.getStats,
    enabled: !!family?.id,
  });

  const totalMemories = memoryStatsData
    ? memoryStatsData.episodic.count + memoryStatsData.semantic.count
    : 0;

  const quickFacts = [
    {
      label: 'Family members',
      value: family?.memberCount || 0,
      icon: Users,
      tone: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700',
    },
    {
      label: 'Stories saved',
      value: storiesData?.pagination.total || 0,
      icon: BookOpen,
      tone: 'from-sky-500/15 to-sky-500/5 text-sky-700',
    },
    {
      label: 'Memories indexed',
      value: totalMemories,
      icon: Heart,
      tone: 'from-rose-500/15 to-rose-500/5 text-rose-700',
    },
    {
      label: 'Upcoming events',
      value: eventsData?.events.length || 0,
      icon: Calendar,
      tone: 'from-amber-500/15 to-amber-500/5 text-amber-700',
    },
  ];

  return (
    <div className="relative mx-auto max-w-6xl space-y-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.88),rgba(255,255,255,0))]" />

      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.35fr_0.9fr] lg:px-8 lg:py-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Family memory hub
            </div>

            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                Welcome to {family?.name || 'Your Family'}
              </h1>
              <p className="max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
                Preserve memories, connect generations, and turn everyday moments into a living family archive.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" />
                Chat with Rememberkin
              </Link>
              <Link
                to="/stories"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:border-primary/20 hover:bg-primary/5"
              >
                <Wand2 className="h-4 w-4 text-primary" />
                Add a story
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickFacts.map((item) => (
                <StatCard
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  tone={item.tone}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-primary/10 via-white to-amber-50 p-5">
              <p className="text-sm font-medium text-gray-500">Today&apos;s focus</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-3 rounded-xl bg-white/80 p-3 shadow-sm">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <TreePine className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Strengthen the family tree</p>
                    <p className="text-sm text-gray-600">Connect people, relationships, and stories in one place.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-white/80 p-3 shadow-sm">
                  <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Keep upcoming milestones visible</p>
                    <p className="text-sm text-gray-600">Birthdays and anniversaries stay front and center.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/95 to-primary/75 p-5 text-white shadow-lg shadow-primary/10">
              <p className="text-sm font-medium text-white/70">Quick start</p>
              <div className="mt-4 space-y-3">
                <Link
                  to="/chat"
                  className="flex items-center justify-between rounded-xl bg-white/12 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Ask a family question
                  <ArrowRight className="h-4 w-4 text-white/70" />
                </Link>
                <Link
                  to="/family"
                  className="flex items-center justify-between rounded-xl bg-white/12 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Review the family tree
                  <ArrowRight className="h-4 w-4 text-white/70" />
                </Link>
                <Link
                  to="/events"
                  className="flex items-center justify-between rounded-xl bg-white/12 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Plan an important date
                  <ArrowRight className="h-4 w-4 text-white/70" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Recent Stories</h2>
              <p className="text-sm text-gray-500">The latest memories captured by your family.</p>
            </div>
            <Link
              to="/stories"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary/80"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {storiesData?.stories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-lg font-medium text-gray-800">No stories yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Start with a memory, a photo caption, or a family moment worth saving.
              </p>
              <Link to="/chat" className="btn-primary mt-5 inline-flex items-center gap-2">
                Start the first story
                <MessageCircle className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {storiesData?.stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
                <p className="text-sm text-gray-500">Dates your family shouldn&apos;t miss.</p>
              </div>
              <Link to="/events" className="text-sm font-medium text-primary transition hover:text-primary/80">
                View all
              </Link>
            </div>

            <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
              {eventsData?.events.length === 0 ? (
                <div className="p-6 text-center">
                  <Calendar className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-500">No upcoming events</p>
                </div>
              ) : (
                eventsData?.events.slice(0, 5).map((event) => (
                  <div key={event.id} className="p-4 transition hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-sm font-semibold">
                          {new Date(event.date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800">{event.title}</p>
                        <p className="text-sm text-gray-500">
                          {event.daysUntil === 0
                            ? 'Today'
                            : event.daysUntil === 1
                              ? 'Tomorrow'
                              : `In ${event.daysUntil} days`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-primary/10 to-amber-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Suggested next step
            </div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">
              Capture one small memory today
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Ask the assistant about a person, place, or event, then turn the answer into a story your family can keep.
            </p>
            <Link
              to="/chat"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Open chat
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <Icon className="mb-3 h-5 w-5" />
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-500">{label}</p>
    </div>
  );
}
