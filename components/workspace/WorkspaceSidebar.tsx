"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  LayoutDashboard,
  Kanban,
  Users,
  FileText,
  ClipboardList,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface WorkspaceSidebarProps {
  folderId: Id<"folders">;
  folderName: string;
}

// Each entry maps a label to its route segment and icon.
const NAV_ITEMS = [
  { label: "Dashboard",          segment: "dashboard",          icon: LayoutDashboard },
  { label: "Pipeline",           segment: "pipeline",           icon: Kanban          },
  { label: "Team",               segment: "team",               icon: Users           },
  { label: "Outreach Schema",    segment: "outreach-schema",    icon: FileText        },
  { label: "EVSF Applications",  segment: "evsf-applications",  icon: ClipboardList   },
  { label: "Notifications",      segment: "notifications",      icon: Bell            },
  { label: "Settings",           segment: "settings",           icon: Settings        },
] as const;

export function WorkspaceSidebar({ folderId, folderName }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const base = `/folders/${folderId}`;

  return (
    <aside className="w-48 min-h-full bg-midnight flex flex-col flex-shrink-0">
      {/* Back to all folders */}
      <div className="px-3 pt-4 pb-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-surface/40 hover:text-surface/70 transition-colors text-xs font-medium"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All folders
        </Link>
      </div>

      {/* Folder name */}
      <div className="px-4 pb-4">
        <h2
          className="font-manrope font-bold text-sm text-surface leading-snug truncate"
          title={folderName}
        >
          {folderName}
        </h2>
      </div>

      {/* Divider */}
      <div className="mx-3 mb-2 h-px bg-surface/10" />

      {/* Navigation links */}
      <nav className="px-2 flex-1 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, segment, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const isActive = pathname.startsWith(href);

          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-surface/10 text-surface"
                  : "text-surface/50 hover:text-surface/80 hover:bg-surface/5"
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
