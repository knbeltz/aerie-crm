"use client";

import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserFolders } from "@/hooks/useFolders";
import { FolderCard } from "@/components/folders/FolderCard";
import { CreateFolderDialog } from "@/components/folders/CreateFolderDialog";
import { JoinFolderDialog } from "@/components/folders/JoinFolderDialog";
import { ReminderBanner } from "@/components/reminders/ReminderBanner";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { folders, isLoading: foldersLoading } = useUserFolders();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-manrope font-extrabold text-2xl text-midnight mb-1">
          {userLoading
            ? "Loading..."
            : `${greeting()}, ${user?.name?.split(" ")[0] ?? "there"}`}
        </h1>
        <p className="text-midnight/50 text-sm">
          {folders.length === 0
            ? "Create your first folder to get started."
            : `You have access to ${folders.length} folder${folders.length !== 1 ? "s" : ""}.`}
        </p>
      </div>

      {/* Reminders */}
      <ReminderBanner />

      {/* My Folders */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-manrope font-bold text-base text-midnight">
            My folders
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setJoinOpen(true)}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Join folder
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              New folder
            </Button>
          </div>
        </div>

        {foldersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-40 bg-surface-2 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-surface-2 rounded-2xl">
            <div className="w-12 h-12 bg-active rounded-xl flex items-center justify-center mb-4">
              <Plus className="w-5 h-5 text-midnight/40" />
            </div>
            <p className="font-manrope font-semibold text-midnight mb-1">
              No folders yet
            </p>
            <p className="text-sm text-midnight/50 mb-5 max-w-xs">
              Folders are collaborative workspaces for your team's deal flow. Create one to get started.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" onClick={() => setJoinOpen(true)}>
                <UserPlus className="w-3.5 h-3.5" />
                Join with code
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Create folder
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={{
                  _id: folder._id,
                  name: folder.name as string,
                  description: folder.description as string | undefined,
                  updatedAt: folder.updatedAt as number,
                  memberCount: folder.memberCount as number,
                  tableCount: folder.tableCount as number,
                  role: folder.role as string,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Dialogs */}
      <CreateFolderDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinFolderDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
