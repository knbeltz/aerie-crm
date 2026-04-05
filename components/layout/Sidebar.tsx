"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, FolderOpen, ChevronRight } from "lucide-react";
import { useUserFolders } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { folders } = useUserFolders();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-56 min-h-screen bg-surface-2 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2">
        <div className="w-7 h-7 bg-midnight rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-surface text-xs font-manrope font-bold">A</span>
        </div>
        <span className="font-manrope font-extrabold text-base text-midnight tracking-tight">
          Aerie
        </span>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-2 flex flex-col gap-0.5">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "aerie-sidebar-link",
              pathname === href && "active"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-2 h-px bg-active" />

      {/* Folders */}
      <div className="px-2 flex-1 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold text-midnight/40 uppercase tracking-widest">
          Folders
        </p>
        {folders.length === 0 ? (
          <p className="px-3 py-2 text-xs text-midnight/40">No folders yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {folders.map((folder) => (
              <Link
                key={folder._id}
                href={`/folders/${folder._id}`}
                className={cn(
                  "aerie-sidebar-link group",
                  pathname.startsWith(`/folders/${folder._id}`) && "active"
                )}
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0 text-midnight/40" />
                <span className="truncate flex-1">{folder.name as string}</span>
                <ChevronRight className="w-3 h-3 text-midnight/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom area */}
      <div className="p-3 mt-auto">
        <div className="rounded-lg bg-active/50 px-3 py-2.5">
          <p className="text-xs text-midnight/40 font-medium">Eagle Venture</p>
          <p className="text-xs text-midnight/30">Seed Fund</p>
        </div>
      </div>
    </aside>
  );
}
