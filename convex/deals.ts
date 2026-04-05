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

async function assertFolderMember(ctx: { auth: any; db: any }, folderId: string) {
  const user = await getAuthedUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_folder_user", (q: any) =>
      q.eq("folderId", folderId).eq("userId", user._id)
    )
    .first();
  if (!membership) throw new Error("Access denied");
  return { user, membership };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getFolderDeals = query({
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

    return await ctx.db
      .query("deals")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .collect();
  },
});

export const getDealsByStage = query({
  args: { stageId: v.id("pipelineStages"), folderId: v.id("folders") },
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

    return await ctx.db
      .query("deals")
      .withIndex("by_folder_stage", (q: any) =>
        q.eq("folderId", args.folderId).eq("stageId", args.stageId)
      )
      .collect();
  },
});

// Returns deals with a stageDeadlineAt within the next 7 days.
export const getUrgentDeals = query({
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

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const deals = await ctx.db
      .query("deals")
      .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
      .collect();

    return deals
      .filter(
        (d: any) =>
          d.stageDeadlineAt !== undefined &&
          d.stageDeadlineAt >= now &&
          d.stageDeadlineAt <= now + sevenDays
      )
      .sort((a: any, b: any) => a.stageDeadlineAt - b.stageDeadlineAt);
  },
});

// Returns aggregated stats for the folder dashboard in a single round-trip.
export const getDashboardStats = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const selfMembership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q: any) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!selfMembership) return null;

    const [stages, deals, members] = await Promise.all([
      ctx.db
        .query("pipelineStages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
        .collect(),
      ctx.db
        .query("deals")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
        .take(500),
      ctx.db
        .query("memberships")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
        .take(100),
    ]);

    // Build stageId → stage lookup
    const stageMap = new Map(stages.map((s: any) => [s._id as string, s]));

    // Tally per-stage counts and derive active/closed totals
    const stageCountMap = new Map<string, number>();
    let activeDeals = 0;
    let closedDeals = 0;

    for (const deal of deals) {
      const sid = deal.stageId as string;
      stageCountMap.set(sid, (stageCountMap.get(sid) ?? 0) + 1);
      const stage = stageMap.get(sid) as any;
      if (stage) {
        if (!stage.isTerminal) activeDeals++;
        else if (stage.terminalType === "closed") closedDeals++;
      }
    }

    const stageBreakdown = stages
      .map((s: any) => ({
        name: s.name as string,
        count: stageCountMap.get(s._id as string) ?? 0,
        color: (s.color as string | undefined) ?? "#6366f1",
        isTerminal: s.isTerminal as boolean,
        order: s.order as number,
      }))
      .sort((a: any, b: any) => a.order - b.order);

    // Urgent: deadline within next 7 days
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const urgentDeals = deals
      .filter(
        (d: any) =>
          d.stageDeadlineAt !== undefined &&
          d.stageDeadlineAt >= now &&
          d.stageDeadlineAt <= now + sevenDays
      )
      .sort((a: any, b: any) => a.stageDeadlineAt - b.stageDeadlineAt)
      .slice(0, 8)
      .map((d: any) => ({
        _id: d._id as string,
        title: d.title as string,
        company: d.company as string | undefined,
        stageDeadlineAt: d.stageDeadlineAt as number,
        stageName: (stageMap.get(d.stageId as string) as any)?.name ?? "Unknown",
        priority: d.priority as string,
      }));

    return {
      totalDeals: deals.length,
      activeDeals,
      closedDeals,
      memberCount: members.length,
      stageBreakdown,
      urgentDeals,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createDeal = mutation({
  args: {
    folderId: v.id("folders"),
    title: v.string(),
    company: v.optional(v.string()),
    stageId: v.id("pipelineStages"),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    stageDeadlineAt: v.optional(v.number()),
    sourceEntryId: v.optional(v.id("entries")),
  },
  handler: async (ctx, args) => {
    const { user } = await assertFolderMember(ctx, args.folderId);
    const now = Date.now();
    return await ctx.db.insert("deals", {
      folderId: args.folderId,
      title: args.title,
      company: args.company,
      stageId: args.stageId,
      assignedTo: [],
      priority: args.priority,
      stageDeadlineAt: args.stageDeadlineAt,
      sourceEntryId: args.sourceEntryId,
      createdBy: user._id,
      lastEditedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const moveDeal = mutation({
  args: {
    dealId: v.id("deals"),
    stageId: v.id("pipelineStages"),
  },
  handler: async (ctx, args) => {
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");
    await assertFolderMember(ctx, deal.folderId);
    const user = await getAuthedUser(ctx);
    await ctx.db.patch(args.dealId, {
      stageId: args.stageId,
      lastEditedBy: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const assignDeal = mutation({
  args: {
    dealId: v.id("deals"),
    assignedTo: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");
    await assertFolderMember(ctx, deal.folderId);
    const user = await getAuthedUser(ctx);
    await ctx.db.patch(args.dealId, {
      assignedTo: args.assignedTo,
      lastEditedBy: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const deleteDeal = mutation({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");
    await assertFolderMember(ctx, deal.folderId);
    await ctx.db.delete(args.dealId);
  },
});
