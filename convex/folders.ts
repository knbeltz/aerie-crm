import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";

export const createFolder = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const inviteCode = nanoid(10);
    const now = Date.now();

    const folderId = await ctx.db.insert("folders", {
      name: args.name,
      description: args.description,
      ownerId: user._id,
      inviteCode,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("memberships", {
      folderId,
      userId: user._id,
      role: "owner",
      joinedAt: now,
    });

    // Seed default pipeline stages: Sourcing → Review → Due Diligence → (terminals)
    const defaultStages = [
      { name: "Sourcing",        order: 0, isTerminal: false, terminalType: undefined, color: "#6366f1", isDefault: true },
      { name: "Review",          order: 1, isTerminal: false, terminalType: undefined, color: "#8b5cf6" },
      { name: "Due Diligence",   order: 2, isTerminal: false, terminalType: undefined, color: "#a855f7" },
      { name: "Closed",          order: 3, isTerminal: true,  terminalType: "closed"   as const, color: "#22c55e" },
      { name: "Rejected",        order: 4, isTerminal: true,  terminalType: "rejected" as const, color: "#ef4444" },
      { name: "Cancelled",       order: 5, isTerminal: true,  terminalType: "cancelled" as const, color: "#6b7280" },
    ];
    await Promise.all(
      defaultStages.map((stage) =>
        ctx.db.insert("pipelineStages", { folderId, ...stage, createdAt: now })
      )
    );

    // Seed folder settings with sensible defaults.
    await ctx.db.insert("folderSettings", {
      folderId,
      whoCanCreateDeals: "all_members",
      whoCanEditDeals: "all_members",
      whoCanMoveDeals: "all_members",
      whoCanInviteMembers: "admins_only",
      notifyOnDealCreated: true,
      notifyOnDealMoved: true,
      notifyOnMemberAdded: true,
      createdAt: now,
      updatedAt: now,
    });

    return folderId;
  },
});

export const getUserFolders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const folders = await Promise.all(
      memberships.map(async (m) => {
        const folder = await ctx.db.get(m.folderId);
        if (!folder) return null;

        const memberCount = await ctx.db
          .query("memberships")
          .withIndex("by_folder", (q) => q.eq("folderId", m.folderId))
          .collect();

        const tableCount = await ctx.db
          .query("tables")
          .withIndex("by_folder", (q) => q.eq("folderId", m.folderId))
          .collect();

        return {
          ...folder,
          role: m.role,
          memberCount: memberCount.length,
          tableCount: tableCount.length,
        };
      })
    );

    // flatMap skips nulls (orphaned memberships) and narrows the type in one step.
    // Using flatMap instead of filter because TypeScript's ternary narrowing is
    // more reliable here than type predicates through Convex's generic layers.
    return folders.flatMap((f) => (f !== null ? [f] : []));
  },
});

export const getFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership) return null;

    const folder = await ctx.db.get(args.folderId);
    return folder ? { ...folder, role: membership.role } : null;
  },
});

export const joinByInviteCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const folder = await ctx.db
      .query("folders")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();
    if (!folder) throw new Error("Invalid invite code");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", folder._id).eq("userId", user._id)
      )
      .first();

    if (existing) throw new Error("Already a member");

    await ctx.db.insert("memberships", {
      folderId: folder._id,
      userId: user._id,
      role: "editor",
      joinedAt: Date.now(),
    });

    return folder._id;
  },
});

export const updateFolder = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership || (membership.role !== "owner" && membership.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }

    const updates: { name?: string; description?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.folderId, updates);
  },
});

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owner can delete folder");
    }

    // Delete all memberships
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();
    await Promise.all(memberships.map((m) => ctx.db.delete(m._id)));

    // Delete all tables (and their fields + entries)
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    for (const table of tables) {
      const fields = await ctx.db
        .query("fields")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();
      await Promise.all(fields.map((f) => ctx.db.delete(f._id)));

      const entries = await ctx.db
        .query("entries")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();
      await Promise.all(entries.map((e) => ctx.db.delete(e._id)));

      await ctx.db.delete(table._id);
    }

    await ctx.db.delete(args.folderId);
  },
});

export const generateNewInviteCode = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owner can regenerate invite code");
    }

    const inviteCode = nanoid(10);
    await ctx.db.patch(args.folderId, { inviteCode, updatedAt: Date.now() });
    return inviteCode;
  },
});
