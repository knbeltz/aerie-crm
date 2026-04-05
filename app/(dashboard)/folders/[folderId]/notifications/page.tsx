"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Bell,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Plus,
  ArrowRight,
  UserCheck,
  Settings,
  FileText,
  Pencil,
  CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

// ─── Notification metadata ────────────────────────────────────────────────────

type NotifType =
  | "member_promoted"
  | "member_added"
  | "member_removed"
  | "deal_created"
  | "deal_moved"
  | "deal_assigned"
  | "schema_updated"
  | "entry_created"
  | "entry_updated";

const EVENT_META: Record<
  NotifType,
  { icon: LucideIcon; bg: string; text: string }
> = {
  member_promoted: { icon: ShieldCheck, bg: "bg-crimson/10",    text: "text-crimson"         },
  member_added:    { icon: UserPlus,    bg: "bg-emerald-100",   text: "text-emerald-600"     },
  member_removed:  { icon: UserMinus,   bg: "bg-red-100",       text: "text-red-600"         },
  deal_created:    { icon: Plus,        bg: "bg-indigo-100",    text: "text-indigo-600"      },
  deal_moved:      { icon: ArrowRight,  bg: "bg-purple-100",    text: "text-purple-600"      },
  deal_assigned:   { icon: UserCheck,   bg: "bg-blue-100",      text: "text-blue-600"        },
  schema_updated:  { icon: Settings,    bg: "bg-active",        text: "text-midnight/60"     },
  entry_created:   { icon: FileText,    bg: "bg-teal-100",      text: "text-teal-600"        },
  entry_updated:   { icon: Pencil,      bg: "bg-orange-100",    text: "text-orange-600"      },
};

const FALLBACK_META = { icon: Bell, bg: "bg-active", text: "text-midnight/60" };

function describeNotification(
  type: string,
  payload: unknown,
  actorName: string
): string {
  const p = (payload ?? {}) as Record<string, string>;
  switch (type as NotifType) {
    case "member_promoted":
      return `${actorName} promoted ${p.targetName ?? "a member"} to ${p.newRole ?? "admin"}`;
    case "member_added":
      return `${actorName} joined the folder`;
    case "member_removed":
      return `${actorName} removed ${p.targetName ?? "a member"} from the folder`;
    case "deal_created":
      return `${actorName} created deal "${p.dealTitle ?? "a deal"}"`;
    case "deal_moved":
      return `${actorName} moved "${p.dealTitle ?? "a deal"}" to ${p.stageName ?? "a new stage"}`;
    case "deal_assigned":
      return `${actorName} updated assignees on "${p.dealTitle ?? "a deal"}"`;
    case "schema_updated":
      return `${actorName} updated the schema`;
    case "entry_created":
      return `${actorName} added a new entry`;
    case "entry_updated":
      return `${actorName} updated an entry`;
    default:
      return `${actorName} performed an action`;
  }
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
}: {
  notification: {
    _id: Id<"folderNotifications">;
    type: string;
    payload: unknown;
    actorName: string;
    isRead: boolean;
    createdAt: number;
  };
  onRead: (id: Id<"folderNotifications">) => void;
}) {
  const meta = EVENT_META[notification.type as NotifType] ?? FALLBACK_META;
  const Icon = meta.icon;
  const description = describeNotification(
    notification.type,
    notification.payload,
    notification.actorName
  );

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-5 py-4 transition-colors cursor-default",
        notification.isRead
          ? "hover:bg-active/10"
          : "bg-crimson/[0.03] hover:bg-crimson/[0.06] border-l-2 border-crimson/40"
      )}
      onClick={() => {
        if (!notification.isRead) onRead(notification._id);
      }}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
          meta.bg
        )}
      >
        <Icon className={cn("w-3.5 h-3.5", meta.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-midnight leading-snug">{description}</p>
        <p className="text-xs text-midnight/40 mt-0.5">
          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.isRead && (
        <div className="w-2 h-2 rounded-full bg-crimson flex-shrink-0 mt-2" />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "all" | "unread";

export default function NotificationsPage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  const notifications = useQuery(api.folderNotifications.getFolderNotifications, {
    folderId,
    limit: 100,
  });

  const markRead = useMutation(api.folderNotifications.markNotificationRead);
  const markAllReadMutation = useMutation(api.folderNotifications.markAllRead);

  const [tab, setTab] = useState<Tab>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => (notifications ?? []).filter((n) => !n.isRead).length,
    [notifications]
  );

  const displayed = useMemo(() => {
    if (!notifications) return [];
    return tab === "unread" ? notifications.filter((n) => !n.isRead) : notifications;
  }, [notifications, tab]);

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllReadMutation({ folderId });
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkRead(id: Id<"folderNotifications">) {
    try {
      await markRead({ notificationId: id });
    } catch {
      // Silent — not worth a toast for a single read mark
    }
  }

  const isLoading = notifications === undefined;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-midnight/40" />
            <h1 className="font-manrope font-extrabold text-2xl text-midnight">
              Notifications
            </h1>
            {!isLoading && unreadCount > 0 && (
              <span className="inline-flex items-center justify-center bg-crimson text-surface text-[10px] font-bold rounded-full w-5 h-5">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-midnight/50">
            Activity and events within this folder.
          </p>
        </div>

        {/* Mark all read */}
        {!isLoading && unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {markingAll ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-active/60">
        {(["all", "unread"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors capitalize border-b-2 -mb-px",
              tab === t
                ? "border-midnight text-midnight"
                : "border-transparent text-midnight/40 hover:text-midnight/70"
            )}
          >
            {t}
            {t === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 text-xs text-crimson font-semibold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="bg-surface-2 rounded-xl divide-y divide-active/30">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-4">
              <div className="w-7 h-7 rounded-full bg-active animate-pulse flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="h-3.5 w-56 bg-active rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-active/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-surface-2 rounded-xl py-16 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl bg-active flex items-center justify-center mb-3">
            <Bell className="w-4 h-4 text-midnight/30" />
          </div>
          <p className="font-manrope font-semibold text-sm text-midnight mb-1">
            {tab === "unread" ? "All caught up" : "No activity yet"}
          </p>
          <p className="text-xs text-midnight/40 max-w-xs">
            {tab === "unread"
              ? "You've read all notifications."
              : "Events like deal moves and team changes will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-surface-2 rounded-xl divide-y divide-active/30 overflow-hidden">
          {displayed.map((n) => (
            <NotificationRow
              key={n._id}
              notification={n as any}
              onRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
