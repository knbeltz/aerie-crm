import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createEmailTracking = mutation({
  args: {
    entryId: v.id("entries"),
    subject: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", entry.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) throw new Error("Access denied");

    return await ctx.db.insert("emailTracking", {
      entryId: args.entryId,
      userId: user._id,
      subject: args.subject,
      notes: args.notes,
      opened: false,
      createdAt: Date.now(),
    });
  },
});

export const getEntryEmailTracking = query({
  args: { entryId: v.id("entries") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const entry = await ctx.db.get(args.entryId);
    if (!entry) return [];

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", entry.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return [];

    return await ctx.db
      .query("emailTracking")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
  },
});

export const markEmailOpened = mutation({
  args: { trackingId: v.id("emailTracking") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const tracking = await ctx.db.get(args.trackingId);
    if (!tracking) throw new Error("Email tracking record not found");

    if (tracking.userId !== user._id) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.trackingId, {
      opened: true,
      sentAt: tracking.sentAt ?? Date.now(),
    });
  },
});
