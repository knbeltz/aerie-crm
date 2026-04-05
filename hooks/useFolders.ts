"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

export function useUserFolders() {
  const folders = useQuery(api.folders.getUserFolders);
  return {
    folders: folders ?? [],
    isLoading: folders === undefined,
  };
}

export function useFolder(folderId: Id<"folders"> | null) {
  const folder = useQuery(
    api.folders.getFolder,
    folderId ? { folderId } : "skip"
  );
  return {
    folder: folder ?? null,
    isLoading: folder === undefined,
  };
}

export function useCreateFolder() {
  const createFolder = useMutation(api.folders.createFolder);

  return async (name: string, description?: string) => {
    try {
      const folderId = await createFolder({ name, description });
      toast.success("Folder created");
      return folderId;
    } catch (err) {
      toast.error("Failed to create folder");
      throw err;
    }
  };
}

export function useJoinFolder() {
  const joinFolder = useMutation(api.folders.joinByInviteCode);

  return async (inviteCode: string) => {
    try {
      const folderId = await joinFolder({ inviteCode });
      toast.success("Joined folder");
      return folderId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join folder";
      toast.error(message);
      throw err;
    }
  };
}

export function useDeleteFolder() {
  const deleteFolder = useMutation(api.folders.deleteFolder);

  return async (folderId: Id<"folders">) => {
    try {
      await deleteFolder({ folderId });
      toast.success("Folder deleted");
    } catch (err) {
      toast.error("Failed to delete folder");
      throw err;
    }
  };
}

export function useGenerateInviteCode() {
  const generate = useMutation(api.folders.generateNewInviteCode);

  return async (folderId: Id<"folders">) => {
    try {
      const code = await generate({ folderId });
      toast.success("New invite link generated");
      return code;
    } catch (err) {
      toast.error("Failed to generate invite code");
      throw err;
    }
  };
}
