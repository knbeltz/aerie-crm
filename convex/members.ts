import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Lightweight query: returns only the caller's role in a folder.
// Used by pages that need permission checks without loading all members.
export const getMyRole = query({
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
    return (membership?.role ?? null) as "owner" | "admin" | "editor" | "viewer" | null;
  },
});

export const getFolderMembers = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!currentUser) return [];

    // Check that current user is a member
    const selfMembership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", currentUser._id)
      )
      .first();
    if (!selfMembership) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;
        return {
          membershipId: m._id,
          userId: user._id,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          role: m.role,
          joinedAt: m.joinedAt,
          // Expose caller's role so the UI can derive permissions client-side
          callerRole: selfMembership.role,
        };
      })
    );

    return members.filter(Boolean);
  },
});

export const updateMemberRole = mutation({
  args: {
    folderId: v.id("folders"),
    targetUserId: v.id("users"),
    // owner can set to admin/editor/viewer; admin can set to editor/viewer only
    newRole: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!currentUser) throw new Error("User not found");

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", currentUser._id)
      )
      .first();

    const callerRole = callerMembership?.role;
    if (callerRole !== "owner" && callerRole !== "admin") {
      throw new Error("Only owner or admin can change roles");
    }

    const targetMembership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", args.targetUserId)
      )
      .first();

    if (!targetMembership) throw new Error("Member not found");
    if (targetMembership.role === "owner") throw new Error("Cannot change owner role");

    // Admins cannot touch other admins or promote anyone to admin
    if (callerRole === "admin") {
      if (targetMembership.role === "admin") {
        throw new Error("Admins cannot change another admin's role");
      }
      if (args.newRole === "admin") {
        throw new Error("Only the owner can promote members to admin");
      }
    }

    await ctx.db.patch(targetMembership._id, { role: args.newRole });
  },
});

export const removeMember = mutation({
  args: {
    folderId: v.id("folders"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!currentUser) throw new Error("User not found");

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", currentUser._id)
      )
      .first();

    const callerRole = callerMembership?.role;
    if (callerRole !== "owner" && callerRole !== "admin") {
      throw new Error("Only owner or admin can remove members");
    }

    if (args.targetUserId === currentUser._id) {
      throw new Error("You cannot remove yourself");
    }

    const targetMembership = await ctx.db
      .query("memberships")
      .withIndex("by_folder_user", (q) =>
        q.eq("folderId", args.folderId).eq("userId", args.targetUserId)
      )
      .first();

    if (!targetMembership) throw new Error("Member not found");

    // Admins can only remove editors and viewers
    if (callerRole === "admin") {
      if (targetMembership.role === "owner" || targetMembership.role === "admin") {
        throw new Error("Admins can only remove editors and viewers");
      }
    }

    await ctx.db.delete(targetMembership._id);
  },
});
