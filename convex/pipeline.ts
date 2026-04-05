import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper: get the authenticated user or throw.
async function getAuthedUser(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

// Helper: assert the user has at least the given role in the folder.
async function assertFolderRole(
  ctx: { auth: any; db: any },
  folderId: string,
  minimumRoles: string[]
) {
  const user = await getAuthedUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_folder_user", (q: any) =>
      q.eq("folderId", folderId).eq("userId", user._id)
    )
    .first();
  if (!membership || !minimumRoles.includes(membership.role)) {
    throw new Error("Insufficient permissions");
  }
  return user;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getPipelineStages = query({
  args: { folderId: v.id("folders") },
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

    const stages = await ctx.db
      .query("pipelineStages")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .collect();

    return stages.sort((a: any, b: any) => a.order - b.order);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createPipelineStage = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertFolderRole(ctx, args.folderId, ["owner", "admin"]);

    const existing = await ctx.db
      .query("pipelineStages")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .collect();

    const maxOrder = existing.reduce(
      (max: number, s: any) => Math.max(max, s.order),
      0
    );

    return await ctx.db.insert("pipelineStages", {
      folderId: args.folderId,
      name: args.name,
      color: args.color,
      order: maxOrder + 1,
      isTerminal: false,
      createdAt: Date.now(),
    });
  },
});

export const reorderStages = mutation({
  args: {
    folderId: v.id("folders"),
    stageOrders: v.array(v.object({ stageId: v.id("pipelineStages"), order: v.number() })),
  },
  handler: async (ctx, args) => {
    await assertFolderRole(ctx, args.folderId, ["owner", "admin"]);
    await Promise.all(
      args.stageOrders.map(({ stageId, order }) =>
        ctx.db.patch(stageId, { order })
      )
    );
  },
});

export const renameStage = mutation({
  args: {
    stageId: v.id("pipelineStages"),
    folderId: v.id("folders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await assertFolderRole(ctx, args.folderId, ["owner", "admin"]);
    const name = args.name.trim();
    if (!name) throw new Error("Stage name cannot be empty");
    await ctx.db.patch(args.stageId, { name });
  },
});

export const deleteStage = mutation({
  args: { stageId: v.id("pipelineStages"), folderId: v.id("folders") },
  handler: async (ctx, args) => {
    await assertFolderRole(ctx, args.folderId, ["owner", "admin"]);

    const stage = await ctx.db.get(args.stageId);
    if (!stage) throw new Error("Stage not found");
    if (stage.isTerminal) throw new Error("Cannot delete terminal stages");
    // Protect the default Sourcing stage at the data layer.
    // Dual check: isDefault flag (new folders) + name fallback (legacy folders).
    if (stage.isDefault || stage.name === "Sourcing") {
      throw new Error("The Sourcing stage cannot be deleted");
    }

    // Move deals in this stage to Sourcing (first non-terminal stage).
    const firstStage = await ctx.db
      .query("pipelineStages")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .collect()
      .then((stages: any[]) =>
        stages.filter((s) => !s.isTerminal).sort((a, b) => a.order - b.order)[0]
      );

    if (firstStage) {
      const affectedDeals = await ctx.db
        .query("deals")
        .withIndex("by_stage", (q: any) => q.eq("stageId", args.stageId))
        .collect();
      await Promise.all(
        affectedDeals.map((deal: any) =>
          ctx.db.patch(deal._id, { stageId: firstStage._id, updatedAt: Date.now() })
        )
      );
    }

    await ctx.db.delete(args.stageId);
  },
});
