'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Menu,
  X,
  Users,
  Building2,
  Inbox,
  Calendar,
  Settings,
  Zap,
  Ticket,
  Package,
  Workflow,
  BarChart3,
  MessageSquare,
  Archive,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ListTodo,
  FileText,
} from 'lucide-react';

// Work section - daily tasks
const workNavigation = [
  { name: 'Daily Driver', href: '/work', icon: Inbox },
  { name: 'Scheduler', href: '/scheduler', icon: Calendar },
];

// Manage section - admin/management tools
const manageNavigation = [
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Process Studio', href: '/process', icon: Workflow },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

// More Tools - secondary navigation
const secondaryNavigation = [
  { name: 'Communications', href: '/communications', icon: MessageSquare },
  { name: 'Transcripts', href: '/transcripts', icon: FileText },
  { name: 'Collateral', href: '/collateral', icon: FolderOpen },
  { name: 'Support Cases', href: '/cases', icon: Ticket },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Deals', href: '/deals', icon: Zap },
  { name: 'Legacy Deals', href: '/legacy-deals', icon: Archive },
  { name: 'Onboarding', href: '/onboarding', icon: ListTodo },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Check if any secondary nav item is active
  const isSecondaryActive = secondaryNavigation.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <span className="text-xl font-bold text-white">X-FORCE</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Work Section */}
          <div className="mb-4">
            <div className="px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Work
              </span>
            </div>
            <div className="space-y-1">
              {workNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
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
          </div>

          {/* Manage Section */}
          <div className="mb-4">
            <div className="px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Manage
              </span>
            </div>
            <div className="space-y-1">
              {manageNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
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
          </div>

          {/* More Tools - Collapsible */}
          <div>
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

            {(showSecondary || isSecondaryActive) && (
              <div className="mt-1 space-y-1">
                {secondaryNavigation.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
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
        </nav>

        {/* Settings */}
        <div className="border-t border-gray-800 px-3 py-4">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            Settings
          </Link>
        </div>
      </div>
    </>
  );
}
