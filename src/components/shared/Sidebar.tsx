'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  Inbox,
  Calendar,
  CheckSquare,
  Settings,
  LogOut,
  Zap,
  Brain,
} from 'lucide-react';

const navigation = [
  { name: 'AI Command', href: '/ai', icon: Brain },
  { name: 'Pipeline', href: '/pipeline', icon: LayoutDashboard },
  { name: 'Deals', href: '/deals', icon: Zap },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors, still redirect to login
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold text-white">X-FORCE</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-800 px-3 py-4 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="w-full group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}
