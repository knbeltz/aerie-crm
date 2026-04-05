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
import { Textarea } from "@/components/ui/textarea";
import { useCreateReminder } from "@/hooks/useReminders";
import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";

interface ReminderDialogProps {
  entryId: Id<"entries">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReminderDialog({ entryId, open, onOpenChange }: ReminderDialogProps) {
  const today = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const [remindAt, setRemindAt] = useState(today);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const createReminder = useCreateReminder();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !remindAt) return;

    setIsLoading(true);
    try {
      await createReminder(entryId, message.trim(), new Date(remindAt).getTime());
      setMessage("");
      setRemindAt(today);
      onOpenChange(false);
    } catch {
      // Error handled in hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set a reminder</DialogTitle>
          <DialogDescription>
            You will be notified about this entry at the specified time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remind-at">Remind me at</Label>
            <Input
              id="remind-at"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              required
              min={today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-msg">Note</Label>
            <Textarea
              id="reminder-msg"
              placeholder="What do you want to remember?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!message.trim() || !remindAt || isLoading}
            >
              {isLoading ? "Setting..." : "Set reminder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
