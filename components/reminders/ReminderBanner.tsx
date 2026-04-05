"use client";

import { Bell, X } from "lucide-react";
import { useDueReminders, useDismissReminder } from "@/hooks/useReminders";
import { Id } from "@/convex/_generated/dataModel";

export function ReminderBanner() {
  const { dueReminders } = useDueReminders();
  const dismissReminder = useDismissReminder();

  if (dueReminders.length === 0) return null;

  return (
    <div className="bg-crimson/10 rounded-xl px-5 py-4 flex items-start gap-4 mb-6">
      <div className="w-8 h-8 bg-crimson/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-crimson" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-midnight">
          {dueReminders.length === 1
            ? "You have 1 due reminder"
            : `You have ${dueReminders.length} due reminders`}
        </p>
        <div className="flex flex-col gap-1.5 mt-2">
          {dueReminders.slice(0, 3).map((reminder) => (
            <div
              key={reminder._id}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm text-midnight/70 truncate">
                {reminder.message}
              </span>
              <button
                onClick={() => dismissReminder(reminder._id as Id<"reminders">)}
                className="text-midnight/30 hover:text-midnight transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {dueReminders.length > 3 && (
            <p className="text-xs text-midnight/40">
              +{dueReminders.length - 3} more...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
