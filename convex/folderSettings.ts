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

// Sensible defaults applied when a folder is first created.
export const DEFAULT_FOLDER_SETTINGS = {
  whoCanCreateDeals: "all_members" as const,
  whoCanEditDeals: "all_members" as const,
  whoCanMoveDeals: "all_members" as const,
  whoCanInviteMembers: "admins_only" as const,
  notifyOnDealCreated: true,
  notifyOnDealMoved: true,
  notifyOnMemberAdded: true,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getFolderSettings = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return null;

    return await ctx.db
      .query("folderSettings")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .first();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

// Idempotent: creates settings with defaults if they don't exist yet.
// Covers legacy folders created before settings seeding was added to createFolder.
// Safe to call repeatedly — does nothing if a record already exists.
export const ensureFolderSettings = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) throw new Error("Not a member of this folder");

    const existing = await ctx.db
      .query("folderSettings")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .first();
    if (existing) return; // Already initialized — nothing to do

    const now = Date.now();
    await ctx.db.insert("folderSettings", {
      folderId: args.folderId,
      ...DEFAULT_FOLDER_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Called internally when a folder is created. Seeds with defaults.
export const initializeFolderSettings = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("folderSettings", {
      folderId: args.folderId,
      ...DEFAULT_FOLDER_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateFolderSettings = mutation({
  args: {
    folderId: v.id("folders"),
    whoCanCreateDeals: v.optional(
      v.union(v.literal("admins_only"), v.literal("all_members"))
    ),
    whoCanEditDeals: v.optional(
      v.union(v.literal("admins_only"), v.literal("all_members"))
    ),
    whoCanMoveDeals: v.optional(
      v.union(v.literal("admins_only"), v.literal("all_members"))
    ),
    whoCanInviteMembers: v.optional(
      v.union(v.literal("admins_only"), v.literal("all_members"))
    ),
    notifyOnDealCreated: v.optional(v.boolean()),
    notifyOnDealMoved: v.optional(v.boolean()),
    notifyOnMemberAdded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only admins can update folder settings");
    }

    let settings = await ctx.db
      .query("folderSettings")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .first();

    // Upsert: if no settings doc exists (legacy folder), create one first.
    if (!settings) {
      const now = Date.now();
      const settingsId = await ctx.db.insert("folderSettings", {
        folderId: args.folderId,
        ...DEFAULT_FOLDER_SETTINGS,
        createdAt: now,
        updatedAt: now,
      });
      settings = await ctx.db.get(settingsId);
    }

    if (!settings) throw new Error("Failed to initialize folder settings");

    const { folderId: _folderId, ...updates } = args;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (updates.whoCanCreateDeals !== undefined) patch.whoCanCreateDeals = updates.whoCanCreateDeals;
    if (updates.whoCanEditDeals !== undefined) patch.whoCanEditDeals = updates.whoCanEditDeals;
    if (updates.whoCanMoveDeals !== undefined) patch.whoCanMoveDeals = updates.whoCanMoveDeals;
    if (updates.whoCanInviteMembers !== undefined) patch.whoCanInviteMembers = updates.whoCanInviteMembers;
    if (updates.notifyOnDealCreated !== undefined) patch.notifyOnDealCreated = updates.notifyOnDealCreated;
    if (updates.notifyOnDealMoved !== undefined) patch.notifyOnDealMoved = updates.notifyOnDealMoved;
    if (updates.notifyOnMemberAdded !== undefined) patch.notifyOnMemberAdded = updates.notifyOnMemberAdded;

    await ctx.db.patch(settings._id, patch);
  },
});
