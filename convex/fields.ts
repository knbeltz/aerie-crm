import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const fieldTypeValidator = v.union(
  v.literal("text"),
  v.literal("email"),
  v.literal("url"),
  v.literal("boolean"),
  v.literal("date"),
  v.literal("select"),
  v.literal("multiselect"),
  v.literal("number")
);

export const createField = mutation({
  args: {
    tableId: v.id("tables"),
    name: v.string(),
    type: fieldTypeValidator,
    options: v.optional(v.array(v.string())),
    required: v.boolean(),
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

    const existingFields = await ctx.db
      .query("fields")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const maxOrder = existingFields.reduce((max, f) => Math.max(max, f.order), -1);

    return await ctx.db.insert("fields", {
      tableId: args.tableId,
      name: args.name,
      type: args.type,
      options: args.options,
      required: args.required,
      order: maxOrder + 1,
    });
  },
});

export const getTableFields = query({
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

    const fields = await ctx.db
      .query("fields")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

export const updateField = mutation({
  args: {
    fieldId: v.id("fields"),
    name: v.optional(v.string()),
    type: v.optional(fieldTypeValidator),
    options: v.optional(v.array(v.string())),
    required: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const field = await ctx.db.get(args.fieldId);
    if (!field) throw new Error("Field not found");

    const table = await ctx.db.get(field.tableId);
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

    const updates: {
      name?: string;
      type?: "text" | "email" | "url" | "boolean" | "date" | "select" | "multiselect" | "number";
      options?: string[];
      required?: boolean;
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.options !== undefined) updates.options = args.options;
    if (args.required !== undefined) updates.required = args.required;

    await ctx.db.patch(args.fieldId, updates);
  },
});

export const deleteField = mutation({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const field = await ctx.db.get(args.fieldId);
    if (!field) throw new Error("Field not found");

    const table = await ctx.db.get(field.tableId);
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

    await ctx.db.delete(args.fieldId);
  },
});

export const reorderFields = mutation({
  args: {
    tableId: v.id("tables"),
    fieldOrders: v.array(v.object({ fieldId: v.id("fields"), order: v.number() })),
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

    await Promise.all(
      args.fieldOrders.map(({ fieldId, order }) =>
        ctx.db.patch(fieldId, { order })
      )
    );
  },
});
