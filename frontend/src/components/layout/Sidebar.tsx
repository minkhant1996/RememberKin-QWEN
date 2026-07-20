import { NavLink } from 'react-router-dom';
import {
  Home,
  MessageCircle,
  Users,
  BookOpen,
  Calendar,
  Search,
  Brain,
  Play,
  ImageIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { familyService } from '../../services/family.service';
import { storyService } from '../../services/story.service';
import { memoryDashboardService } from '../../services/memory-dashboard.service';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/memory', icon: Brain, label: 'Memory' },
  { to: '/family', icon: Users, label: 'Family Tree' },
  { to: '/stories', icon: BookOpen, label: 'Stories' },
  { to: '/events', icon: Calendar, label: 'Events' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/portraits', icon: ImageIcon, label: 'Portraits' },
  { to: '/simulation', icon: Play, label: 'Simulation' },
];

export default function Sidebar() {
  const { user } = useAuthStore();
  const hasFamilyId = !!user?.familyId;

  const { data: familyData } = useQuery({
    queryKey: ['family'],
    queryFn: familyService.getFamily,
    enabled: hasFamilyId,
  });

  const { data: storiesData } = useQuery({
    queryKey: ['stories', { limit: 1 }],
    queryFn: () => storyService.getStories({ limit: 1 }),
    enabled: hasFamilyId,
  });

  const { data: memoryStatsData } = useQuery({
    queryKey: ['memory-stats'],
    queryFn: memoryDashboardService.getStats,
    enabled: hasFamilyId,
  });

  const memberCount = familyData?.memberCount ?? '—';
  const storyCount = storiesData?.pagination.total ?? '—';
  const memoryCount = memoryStatsData
    ? memoryStatsData.episodic.count + memoryStatsData.semantic.count
    : '—';

  return (
    <aside className="fixed left-0 top-[61px] bottom-0 w-64 bg-white border-r border-gray-200 hidden lg:block">
      <nav className="p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Quick stats */}
      {hasFamilyId && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-warm-100 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Family Stats
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>{memberCount} family members</p>
              <p>{storyCount} stories shared</p>
              <p>{memoryCount} memories saved</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
