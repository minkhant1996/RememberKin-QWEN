import { NavLink } from 'react-router-dom';
import { Home, MessageCircle, Brain, BookOpen, Search } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/memory', icon: Brain, label: 'Memory' },
  { to: '/stories', icon: BookOpen, label: 'Stories' },
  { to: '/search', icon: Search, label: 'Search' },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center py-2 transition-colors',
                isActive
                  ? 'text-primary-600 font-semibold'
                  : 'text-gray-500 hover:text-gray-900'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs mt-1">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
