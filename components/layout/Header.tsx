"use client";

import { Bell, Search } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useDueReminders } from "@/hooks/useReminders";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderProps {
  breadcrumb?: { label: string; href?: string }[];
}

export function Header({ breadcrumb = [] }: HeaderProps) {
  const { dueReminders } = useDueReminders();

  return (
    <TooltipProvider>
      <header className="h-14 bg-surface-2 flex items-center px-5 gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {breadcrumb.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-midnight/25 text-sm">/</span>
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-sm text-midnight/50 hover:text-midnight transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-sm font-medium text-midnight truncate">
                  {crumb.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-midnight/30" />
          <input
            type="text"
            placeholder="Search..."
            className="h-8 pl-8 pr-4 bg-active rounded-lg text-sm text-midnight placeholder:text-midnight/30 focus:outline-none focus:ring-2 focus:ring-crimson/30 transition-all w-48 focus:w-64"
          />
        </div>

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-active transition-colors">
              <Bell className="w-4 h-4 text-midnight/60" />
              {dueReminders.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-crimson rounded-full" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {dueReminders.length > 0
              ? `${dueReminders.length} due reminder${dueReminders.length > 1 ? "s" : ""}`
              : "No due reminders"}
          </TooltipContent>
        </Tooltip>

        {/* User */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-7 h-7",
              userButtonPopoverCard: "shadow-xl rounded-xl",
            },
          }}
        />
      </header>
    </TooltipProvider>
  );
}
