import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const checkDuplicate = query({
  args: {
    tableId: v.id("tables"),
    emailValue: v.optional(v.string()),
    nameValue: v.optional(v.string()),
    excludeEntryId: v.optional(v.id("entries")),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const duplicates = entries.filter((entry) => {
      if (args.excludeEntryId && entry._id === args.excludeEntryId) return false;
      const data = entry.data as Record<string, unknown>;
      if (args.emailValue && typeof data["email"] === "string") {
        if (data["email"].toLowerCase() === args.emailValue.toLowerCase()) return true;
      }
      if (args.nameValue && typeof data["name"] === "string") {
        if (data["name"].toLowerCase() === args.nameValue.toLowerCase()) return true;
      }
      return false;
    });

    return await Promise.all(
      duplicates.map(async (entry) => {
        const creator = await ctx.db.get(entry.createdBy);
        return {
          ...entry,
          createdByName: creator?.name ?? "Unknown",
        };
      })
    );
  },
});

export const createEntry = mutation({
  args: {
    tableId: v.id("tables"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const table = await ctx.db.get(args.tableId);
    if (!table) throw new Error("Table not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", table.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "viewer") {
      throw new Error("Insufficient permissions");
    }

    const now = Date.now();
    return await ctx.db.insert("entries", {
      tableId: args.tableId,
      folderId: table.folderId,
      data: args.data,
      createdBy: user._id,
      lastEditedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getTableEntries = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const table = await ctx.db.get(args.tableId);
    if (!table) return [];

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", table.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return [];

    const entries = await ctx.db
      .query("entries")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    // Enrich with creator info
    return await Promise.all(
      entries.map(async (entry) => {
        const creator = await ctx.db.get(entry.createdBy);
        const lastEditor = await ctx.db.get(entry.lastEditedBy);
        return {
          ...entry,
          createdByName: creator?.name ?? "Unknown",
          lastEditedByName: lastEditor?.name ?? "Unknown",
        };
      })
    );
  },
});

export const getEntry = query({
  args: { entryId: v.id("entries") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const entry = await ctx.db.get(args.entryId);
    if (!entry) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", entry.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return null;

    const creator = await ctx.db.get(entry.createdBy);
    const lastEditor = await ctx.db.get(entry.lastEditedBy);

    return {
      ...entry,
      createdByName: creator?.name ?? "Unknown",
      lastEditedByName: lastEditor?.name ?? "Unknown",
    };
  },
});

export const updateEntry = mutation({
  args: {
    entryId: v.id("entries"),
    data: v.any(),
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

    if (!membership || membership.role === "viewer") {
      throw new Error("Insufficient permissions");
    }

    await ctx.db.patch(args.entryId, {
      data: args.data,
      lastEditedBy: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const deleteEntry = mutation({
  args: { entryId: v.id("entries") },
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

    if (!membership || membership.role === "viewer") {
      throw new Error("Insufficient permissions");
    }

    // Delete associated reminders
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
    await Promise.all(reminders.map((r) => ctx.db.delete(r._id)));

    // Delete associated email tracking
    const emailTrackings = await ctx.db
      .query("emailTracking")
      .withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
      .collect();
    await Promise.all(emailTrackings.map((e) => ctx.db.delete(e._id)));

    await ctx.db.delete(args.entryId);
  },
});

export const searchEntries = query({
  args: {
    tableId: v.id("tables"),
    searchText: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const table = await ctx.db.get(args.tableId);
    if (!table) return [];

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", table.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return [];

    if (!args.searchText.trim()) return [];

    const entries = await ctx.db
      .query("entries")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const lowerSearch = args.searchText.toLowerCase();

    const matched = entries.filter((entry) => {
      const data = entry.data as Record<string, unknown>;
      return Object.values(data).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(lowerSearch);
      });
    });

    // Enrich with creator info — same shape as getTableEntries so consumers
    // don't need to handle two different entry shapes.
    return await Promise.all(
      matched.map(async (entry) => {
        const creator = await ctx.db.get(entry.createdBy);
        const lastEditor = await ctx.db.get(entry.lastEditedBy);
        return {
          ...entry,
          createdByName: creator?.name ?? "Unknown",
          lastEditedByName: lastEditor?.name ?? "Unknown",
        };
      })
    );
  },
});
