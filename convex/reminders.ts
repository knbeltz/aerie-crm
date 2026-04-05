import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createReminder = mutation({
  args: {
    entryId: v.id("entries"),
    message: v.string(),
    remindAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    // Verify entry exists and user has access
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", entry.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) throw new Error("Access denied");

    return await ctx.db.insert("reminders", {
      entryId: args.entryId,
      userId: user._id,
      message: args.message,
      remindAt: args.remindAt,
      dismissed: false,
      createdAt: Date.now(),
    });
  },
});

export const getUserReminders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_user_undismissed", (q) =>
        q.eq("userId", user._id).eq("dismissed", false)
      )
      .collect();

    return await Promise.all(
      reminders.map(async (r) => {
        const entry = await ctx.db.get(r.entryId);
        return {
          ...r,
          entryData: entry?.data ?? null,
          entryTableId: entry?.tableId ?? null,
        };
      })
    );
  },
});

export const getDueReminders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const now = Date.now();
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_user_undismissed", (q) =>
        q.eq("userId", user._id).eq("dismissed", false)
      )
      .collect();

    return reminders.filter((r) => r.remindAt <= now);
  },
});

export const dismissReminder = mutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) throw new Error("Reminder not found");
    if (reminder.userId !== user._id) throw new Error("Access denied");

    await ctx.db.patch(args.reminderId, { dismissed: true });
  },
});

export const updateReminder = mutation({
  args: {
    reminderId: v.id("reminders"),
    message: v.optional(v.string()),
    remindAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) throw new Error("Reminder not found");
    if (reminder.userId !== user._id) throw new Error("Access denied");

    const updates: { message?: string; remindAt?: number } = {};
    if (args.message !== undefined) updates.message = args.message;
    if (args.remindAt !== undefined) updates.remindAt = args.remindAt;

    await ctx.db.patch(args.reminderId, updates);
  },
});
