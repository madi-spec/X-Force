'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Building2,
  Calendar,
  Settings,
  LogOut,
  Zap,
  MessageSquare,
  Package,
  ListTodo,
  Archive,
  Ticket,
  Inbox,
  Users,
  Workflow,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { LensSwitcher } from '@/components/lens';
import { isNavItemHidden, UserRole } from '@/lib/lens';

interface NavItem {
  id: string;          // Used for role-based hiding
  name: string;
  href: string;
  icon: typeof Inbox;
}

// Primary navigation - new IA structure with IDs for role-based hiding
const primaryNavigation: NavItem[] = [
  { id: 'work', name: 'Work', href: '/work', icon: Inbox },
  { id: 'scheduler', name: 'Scheduler', href: '/scheduler', icon: Calendar },
  { id: 'customers', name: 'Customers', href: '/customers', icon: Users },
  { id: 'process', name: 'Process Studio', href: '/process', icon: Workflow },
  { id: 'products', name: 'Products', href: '/products', icon: Package },
  { id: 'reports', name: 'Reports', href: '/reports', icon: BarChart3 },
];

// Secondary navigation - other tools with IDs for role-based hiding
// NOTE: Command Center and Daily Driver removed - functionality consolidated into Work Queue
const secondaryNavigation: NavItem[] = [
  { id: 'communications', name: 'Communications', href: '/communications', icon: MessageSquare },
  { id: 'support_cases', name: 'Support Cases', href: '/cases', icon: Ticket },
  { id: 'companies', name: 'Companies', href: '/companies', icon: Building2 },
  { id: 'pipeline', name: 'Deals', href: '/deals', icon: Zap },
  { id: 'legacy_deals', name: 'Legacy Deals', href: '/legacy-deals', icon: Archive },
  { id: 'onboarding_dashboard', name: 'Onboarding', href: '/onboarding', icon: ListTodo },
];

const bottomNavigation: NavItem[] = [
  { id: 'settings', name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  /** User's role for nav item filtering. Defaults to 'admin' (sees everything) */
  userRole?: UserRole;
}

export function Sidebar({ userRole = 'admin' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showSecondary, setShowSecondary] = useState(false);

  // Filter navigation items based on user role
  const filteredPrimaryNav = useMemo(
    () => primaryNavigation.filter(item => !isNavItemHidden(userRole, item.id)),
    [userRole]
  );

  const filteredSecondaryNav = useMemo(
    () => secondaryNavigation.filter(item => !isNavItemHidden(userRole, item.id)),
    [userRole]
  );

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

  // Check if any secondary nav item is active
  const isSecondaryActive = filteredSecondaryNav.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <div className="hidden lg:flex h-full w-64 flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold text-white">X-FORCE</span>
      </div>

      {/* Lens Switcher */}
      <div className="px-3 pb-4">
        <LensSwitcher variant="sidebar" />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto border-t border-gray-800">
        <div className="space-y-1">
          {filteredPrimaryNav.map((item) => {
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
        </div>

        {/* Secondary Navigation - Collapsible (only show if there are items) */}
        {filteredSecondaryNav.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowSecondary(!showSecondary)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors rounded-lg',
              isSecondaryActive
                ? 'text-gray-300'
                : 'text-gray-500 hover:text-gray-400'
            )}
          >
            <span>More Tools</span>
            {showSecondary ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {(showSecondary || isSecondaryActive) && filteredSecondaryNav.length > 0 && (
            <div className="mt-1 space-y-1">
              {filteredSecondaryNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}
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
