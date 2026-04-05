import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Typed-table queries ──────────────────────────────────────────────────────

// Returns the folder's outreach table, or null if not yet created.
export const getOutreachTable = query({
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

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    return tables.find((t) => t.tableType === "outreach") ?? null;
  },
});

// Returns the folder's EVSF Applications table, or null if not yet initialised.
export const getEvsfTable = query({
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

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    return tables.find((t) => t.tableType === "evsf") ?? null;
  },
});

// ─── Typed-table init mutations ───────────────────────────────────────────────

const OUTREACH_DEFAULT_FIELDS = [
  { name: "Name",    type: "text"  as const, required: true,  order: 0 },
  { name: "Email",   type: "email" as const, required: false, order: 1 },
  { name: "Company", type: "text"  as const, required: false, order: 2 },
  { name: "Role",    type: "text"  as const, required: false, order: 3 },
  { name: "Website", type: "url"   as const, required: false, order: 4 },
  { name: "Notes",   type: "text"  as const, required: false, order: 5 },
];

// Creates the folder's outreach table and seeds default fields.
// Owner/admin only. Idempotent — throws if table already exists.
export const initOutreachTable = mutation({
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
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Only owner or admin can create the Outreach Schema");
    }

    // Guard against duplicates
    const existing = await ctx.db
      .query("tables")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();
    if (existing.some((t) => t.tableType === "outreach")) {
      throw new Error("Outreach schema already exists");
    }

    const now = Date.now();
    const tableId = await ctx.db.insert("tables", {
      folderId: args.folderId,
      name: "Outreach",
      tableType: "outreach",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    for (const field of OUTREACH_DEFAULT_FIELDS) {
      await ctx.db.insert("fields", {
        tableId,
        name: field.name,
        type: field.type,
        required: field.required,
        order: field.order,
      });
    }

    return tableId;
  },
});

// Creates the folder's EVSF Applications table.
// If cloneFromTableId is provided, copies its fields (structure only, no entries).
// Owner/admin only.
export const initEvsfTable = mutation({
  args: {
    folderId: v.id("folders"),
    cloneFromTableId: v.optional(v.id("tables")),
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
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Only owner or admin can initialize EVSF Applications");
    }

    // Guard against duplicates
    const existing = await ctx.db
      .query("tables")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();
    if (existing.some((t) => t.tableType === "evsf")) {
      throw new Error("EVSF Applications table already exists");
    }

    const now = Date.now();
    const tableId = await ctx.db.insert("tables", {
      folderId: args.folderId,
      name: "EVSF Applications",
      tableType: "evsf",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    if (args.cloneFromTableId) {
      // Clone field structure from the source table
      const sourceFields = await ctx.db
        .query("fields")
        .withIndex("by_table", (q) => q.eq("tableId", args.cloneFromTableId!))
        .collect();

      const sorted = [...sourceFields].sort((a, b) => a.order - b.order);
      for (const f of sorted) {
        await ctx.db.insert("fields", {
          tableId,
          name: f.name,
          type: f.type,
          required: f.required,
          order: f.order,
          options: f.options,
        });
      }
    } else {
      // Start fresh with the same defaults as outreach
      for (const field of OUTREACH_DEFAULT_FIELDS) {
        await ctx.db.insert("fields", {
          tableId,
          name: field.name,
          type: field.type,
          required: field.required,
          order: field.order,
        });
      }
    }

    return tableId;
  },
});

export const createTable = mutation({
  args: {
    folderId: v.id("folders"),
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

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "viewer") {
      throw new Error("Insufficient permissions");
    }

    const now = Date.now();
    return await ctx.db.insert("tables", {
      folderId: args.folderId,
      name: args.name,
      description: args.description,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getFolderTables = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return [];

    return await ctx.db
      .query("tables")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();
  },
});

export const getTable = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const table = await ctx.db.get(args.tableId);
    if (!table) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", table.folderId).eq("userId", user._id)
      )
      .first();
    if (!membership) return null;

    return table;
  },
});

export const updateTable = mutation({
  args: {
    tableId: v.id("tables"),
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

    const updates: { name?: string; description?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.tableId, updates);
  },
});

export const deleteTable = mutation({
  args: { tableId: v.id("tables") },
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

    if (!membership || (membership.role !== "owner" && membership.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }

    // Delete all fields
    const fields = await ctx.db
      .query("fields")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();
    await Promise.all(fields.map((f) => ctx.db.delete(f._id)));

    // Delete all entries
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();
    await Promise.all(entries.map((e) => ctx.db.delete(e._id)));

    await ctx.db.delete(args.tableId);
  },
});
