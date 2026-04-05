"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import Link from "next/link";

// This layout wraps every page under /folders/[folderId]/.
//
// Next.js stacks layouts from the outside in:
//   RootLayout → (dashboard)/layout → [folderId]/layout → page
//
// The outer (dashboard)/layout already provides the GlobalSidebar and Header.
// This layout adds the folder-specific WorkspaceSidebar as a second column
// inside the main content area.

export default function FolderWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  const folder = useQuery(api.folders.getFolder, { folderId });

  // While the folder data is loading, show a minimal skeleton so the
  // workspace sidebar doesn't flash in after the page content.
  if (folder === undefined) {
    return (
      <div className="flex flex-1 min-h-full -m-6">
        <div className="w-48 bg-midnight flex-shrink-0 animate-pulse" />
        <div className="flex-1 p-6">{children}</div>
      </div>
    );
  }

  // If the user has no access or the folder doesn't exist, show a clear error
  // rather than a blank page.
  if (folder === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <p className="font-manrope font-bold text-lg text-midnight mb-2">
          Folder not found
        </p>
        <p className="text-sm text-midnight/50 mb-6">
          This folder doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-crimson hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    // -m-6 pulls the workspace flush against the edges of the outer <main>
    // container (which adds p-6). The workspace then manages its own padding.
    <div className="flex min-h-full -m-6">
      <WorkspaceSidebar folderId={folderId} folderName={folder.name} />
      <div className="flex-1 p-6 overflow-auto min-w-0">{children}</div>
    </div>
  );
}
