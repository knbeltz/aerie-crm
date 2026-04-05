"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJoinFolder } from "@/hooks/useFolders";
import { useRouter } from "next/navigation";

interface JoinFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinFolderDialog({ open, onOpenChange }: JoinFolderDialogProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const joinFolder = useJoinFolder();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsLoading(true);
    try {
      const folderId = await joinFolder(inviteCode.trim());
      setInviteCode("");
      onOpenChange(false);
      router.push(`/folders/${folderId}`);
    } catch {
      // Error handled in hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Join a folder</DialogTitle>
          <DialogDescription>
            Enter the invite code shared by a folder owner to join their workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              placeholder="e.g. abc123xyz"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoFocus
              required
            />
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!inviteCode.trim() || isLoading}>
              {isLoading ? "Joining..." : "Join folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
