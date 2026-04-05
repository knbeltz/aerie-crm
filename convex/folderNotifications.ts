import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getAuthedUser(ctx: { auth: any; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

// Returns the most recent 50 notifications for a folder, newest first.
export const getFolderNotifications = query({
  args: {
    folderId: v.id("folders"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return [];

    const notifications = await ctx.db
      .query("folderNotifications")
      .withIndex("by_folder_created", (q) =>
        q.eq("folderId", args.folderId)
      )
      .order("desc")
      .take(args.limit ?? 50);

    // Enrich each notification with the actor's display name.
    // n is Doc<"folderNotifications">, so n.actorId is Id<"users">,
    // and db.get resolves to Doc<"users"> | null — actor?.name is safe.
    return await Promise.all(
      notifications.map(async (n) => {
        const actor = await ctx.db.get(n.actorId);
        return {
          ...n,
          actorName: actor?.name ?? "Unknown",
          isRead: n.readBy.includes(user._id),
        };
      })
    );
  },
});

export const getUnreadCount = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return 0;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return 0;

    const all = await ctx.db
      .query("folderNotifications")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    return all.filter((n) => !n.readBy.includes(user._id)).length;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const markNotificationRead = mutation({
  args: { notificationId: v.id("folderNotifications") },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");

    if (!notification.readBy.includes(user._id)) {
      await ctx.db.patch(args.notificationId, {
        readBy: [...notification.readBy, user._id],
      });
    }
  },
});

export const markAllRead = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) throw new Error("Access denied");

    const unread = await ctx.db
      .query("folderNotifications")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect()
      .then((ns) => ns.filter((n) => !n.readBy.includes(user._id)));

    await Promise.all(
      unread.map((n) =>
        ctx.db.patch(n._id, { readBy: [...n.readBy, user._id] })
      )
    );
  },
});

// Internal helper — called by other mutations to record activity.
// Not exported as a public HTTP function; called within server-side logic.
export const createNotification = mutation({
  args: {
    folderId: v.id("folders"),
    actorId: v.id("users"),
    type: v.union(
      v.literal("member_promoted"),
      v.literal("member_added"),
      v.literal("member_removed"),
      v.literal("deal_created"),
      v.literal("deal_moved"),
      v.literal("deal_assigned"),
      v.literal("schema_updated"),
      v.literal("entry_created"),
      v.literal("entry_updated")
    ),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("folderNotifications", {
      folderId: args.folderId,
      actorId: args.actorId,
      type: args.type,
      payload: args.payload,
      readBy: [],
      createdAt: Date.now(),
    });
  },
});
