import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Creates an EVSF Application entry and atomically seeds a linked deal in the
// pipeline. The deal's sourceEntryId links back to the entry so the Pipeline
// board can display the application's origin.
//
// Deal title is derived from the entry data in priority order:
//   data["Company"] → data["Name"] → "New Application"
export const createEvsfEntry = mutation({
  args: {
    folderId: v.id("folders"),
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

    // Membership check — viewers cannot create entries
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership || membership.role === "viewer") {
      throw new Error("Insufficient permissions");
    }

    // Confirm the table is an EVSF table in this folder
    const table = await ctx.db.get(args.tableId);
    if (!table || table.folderId !== args.folderId || table.tableType !== "evsf") {
      throw new Error("Invalid EVSF table");
    }

    const now = Date.now();

    // 1. Create the entry
    const entryId = await ctx.db.insert("entries", {
      tableId: args.tableId,
      folderId: args.folderId,
      data: args.data,
      createdBy: user._id,
      lastEditedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Find the first non-terminal pipeline stage (lowest order)
    const stages = await ctx.db
      .query("pipelineStages")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    const firstStage = stages
      .filter((s) => !s.isTerminal)
      .sort((a, b) => a.order - b.order)[0];

    // 3. Derive a meaningful deal title from the entry data
    const entryData = args.data as Record<string, unknown>;
    const dealTitle =
      (typeof entryData["Company"] === "string" && entryData["Company"].trim()) ||
      (typeof entryData["Name"] === "string" && entryData["Name"].trim()) ||
      "New Application";

    const company =
      typeof entryData["Company"] === "string" && entryData["Company"].trim()
        ? entryData["Company"].trim()
        : undefined;

    // 4. Create the linked deal (only if a stage exists)
    let dealId: string | null = null;
    if (firstStage) {
      dealId = await ctx.db.insert("deals", {
        folderId: args.folderId,
        title: dealTitle,
        company,
        stageId: firstStage._id,
        assignedTo: [],
        priority: "medium",
        sourceEntryId: entryId,
        createdBy: user._id,
        lastEditedBy: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { entryId, dealId };
  },
});
