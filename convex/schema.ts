import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Core Identity ───────────────────────────────────────────────────────────

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // ─── Workspace (Folder) ───────────────────────────────────────────────────────

  folders: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_invite_code", ["inviteCode"]),

  // Role hierarchy: owner > admin > editor > viewer
  // owner  — folder creator; one per folder; full control
  // admin  — elevated member; can manage team and pipeline
  // editor — can create/edit content; cannot manage team
  // viewer — read-only
  memberships: defineTable({
    folderId: v.id("folders"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    joinedAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_user", ["userId"])
    .index("by_folder_user", ["folderId", "userId"]),

  // ─── Dynamic Schema (Outreach / EVSF tables) ──────────────────────────────────

  tables: defineTable({
    folderId: v.id("folders"),
    name: v.string(),
    description: v.optional(v.string()),
    // "outreach" = the folder's outreach contact table (one per folder)
    // "evsf"     = the EVSF Applications table (one per folder)
    // undefined  = generic user-created table
    tableType: v.optional(v.union(v.literal("outreach"), v.literal("evsf"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_folder", ["folderId"]),

  fields: defineTable({
    tableId: v.id("tables"),
    name: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("email"),
      v.literal("url"),
      v.literal("boolean"),
      v.literal("date"),
      v.literal("select"),
      v.literal("multiselect"),
      v.literal("number")
    ),
    options: v.optional(v.array(v.string())),
    required: v.boolean(),
    order: v.number(),
  }).index("by_table", ["tableId"]),

  // Entry data is schema-agnostic: keys match field names, values are anything.
  entries: defineTable({
    tableId: v.id("tables"),
    folderId: v.id("folders"),
    data: v.any(),
    createdBy: v.id("users"),
    lastEditedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_table", ["tableId"])
    .index("by_folder", ["folderId"]),

  // ─── Pipeline ─────────────────────────────────────────────────────────────────

  // Custom stages are per-folder. Three terminal stages always exist:
  // "Sourcing" is the default entry stage (seeded on folder creation).
  // Terminal stages (closed/rejected/cancelled) cannot be re-entered.
  pipelineStages: defineTable({
    folderId: v.id("folders"),
    name: v.string(),
    order: v.number(),
    color: v.optional(v.string()),
    // Terminal stages represent final outcomes — deals cannot be moved out of them.
    isTerminal: v.boolean(),
    terminalType: v.optional(
      v.union(
        v.literal("closed"),
        v.literal("rejected"),
        v.literal("cancelled")
      )
    ),
    // True on the seeded "Sourcing" stage — prevents deletion.
    // Optional so existing stages without this field read as undefined (falsy).
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_folder", ["folderId"]),

  // Each deal belongs to exactly one pipeline stage at a time.
  // assignedTo is an array so multiple team members can own a deal.
  // sourceEntryId links a deal back to its originating outreach entry,
  // enabling the EVSF Applications feature.
  deals: defineTable({
    folderId: v.id("folders"),
    title: v.string(),
    company: v.optional(v.string()),
    stageId: v.id("pipelineStages"),
    assignedTo: v.array(v.id("users")),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    // If set, this deal appears in the "Urgent Deals" card when within 7 days.
    stageDeadlineAt: v.optional(v.number()),
    // Optional back-reference to the outreach entry that generated this deal.
    sourceEntryId: v.optional(v.id("entries")),
    createdBy: v.id("users"),
    lastEditedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_stage", ["stageId"])
    .index("by_folder_stage", ["folderId", "stageId"]),

  // ─── Activity / Notifications ─────────────────────────────────────────────────

  // Durable event log for folder activity. Each event records who did what.
  // readBy is an array of user IDs — marking read is per-user, non-destructive.
  // payload carries contextual data (e.g. the stage a deal moved to).
  folderNotifications: defineTable({
    folderId: v.id("folders"),
    actorId: v.id("users"),
    type: v.union(
      v.literal("member_promoted"),
      v.literal("member_added"),
      v.literal("member_removed"),
      v.literal("deal_created"),
      v.literal("deal_moved"),
      v.literal("deal_assigned"),
      v.literal("schema_updated"),
      v.literal("entry_created"),
      v.literal("entry_updated")
    ),
    payload: v.any(),
    readBy: v.array(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_folder_created", ["folderId", "createdAt"]),

  // ─── Per-entry Reminders & Email Tracking (existing) ─────────────────────────

  reminders: defineTable({
    entryId: v.id("entries"),
    userId: v.id("users"),
    message: v.string(),
    remindAt: v.number(),
    dismissed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_entry", ["entryId"])
    .index("by_user_undismissed", ["userId", "dismissed"]),

  emailTracking: defineTable({
    entryId: v.id("entries"),
    userId: v.id("users"),
    sentAt: v.optional(v.number()),
    opened: v.boolean(),
    subject: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_entry", ["entryId"])
    .index("by_user", ["userId"]),

  // ─── Folder Settings ──────────────────────────────────────────────────────────

  // One document per folder, created with defaults when the folder is created.
  // Stored separately from the folders table so it can grow independently.
  folderSettings: defineTable({
    folderId: v.id("folders"),
    whoCanCreateDeals: v.union(
      v.literal("admins_only"),
      v.literal("all_members")
    ),
    whoCanEditDeals: v.union(
      v.literal("admins_only"),
      v.literal("all_members")
    ),
    whoCanMoveDeals: v.union(
      v.literal("admins_only"),
      v.literal("all_members")
    ),
    whoCanInviteMembers: v.union(
      v.literal("admins_only"),
      v.literal("all_members")
    ),
    notifyOnDealCreated: v.boolean(),
    notifyOnDealMoved: v.boolean(),
    notifyOnMemberAdded: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_folder", ["folderId"]),
});
