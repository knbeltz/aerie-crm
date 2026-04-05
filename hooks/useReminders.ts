"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

export function useUserReminders() {
  const reminders = useQuery(api.reminders.getUserReminders);
  return {
    reminders: reminders ?? [],
    isLoading: reminders === undefined,
  };
}

export function useDueReminders() {
  const reminders = useQuery(api.reminders.getDueReminders);
  return {
    dueReminders: reminders ?? [],
    isLoading: reminders === undefined,
  };
}

export function useCreateReminder() {
  const createReminder = useMutation(api.reminders.createReminder);

  return async (entryId: Id<"entries">, message: string, remindAt: number) => {
    try {
      await createReminder({ entryId, message, remindAt });
      toast.success("Reminder set");
    } catch (err) {
      toast.error("Failed to create reminder");
      throw err;
    }
  };
}

export function useDismissReminder() {
  const dismiss = useMutation(api.reminders.dismissReminder);

  return async (reminderId: Id<"reminders">) => {
    try {
      await dismiss({ reminderId });
    } catch (err) {
      toast.error("Failed to dismiss reminder");
      throw err;
    }
  };
}
